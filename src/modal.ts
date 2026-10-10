// 「パックの中身」モーダル(§9.4): 合計と予算・伏せ字の件数・絞り込みと候補(FR-4)・一覧(FR-5)・除外/読めない/加えなかったリンク。
// チェックを変えるたびに組み立て直し、ノートは読み直さない。コピーボタンの処理の最初で writeText を呼ぶ(D-19)。
// 伏せ字の前の本文はどこにも出さない(INV-2)。要素は createEl 系だけで作る(INV-8)。
import { Modal, type TFile } from "obsidian";
import { copyPack } from "./clipboard";
import { formatNumber } from "./core/count";
import { assemble, formatDateTime, prepareNote, summaryLine, type AssembleOptions, type AssembleResult } from "./core/emit";
import type { Masker } from "./core/mask";
import { comparePaths, orderNotes, queryMatches } from "./core/paths";
import type { PreparedNote } from "./core/types";
import type NoteShuttlePlugin from "./main";
import { readNote, type ReadResult } from "./read";
import { excludeRule, type SkippedLink } from "./select";

interface Entry {
	file: TFile;
	path: string;
	mtime: number;
	note: PreparedNote | null;
	checked: boolean;
}

export interface PackModalInit {
	files: TFile[];
	skippedLinks?: SkippedLink[];
	/** FR-1 で読み済みの物(読み直さない) */
	preread?: Map<string, ReadResult>;
}

export class PackModal extends Modal {
	private readonly opts: AssembleOptions & { keepFrontmatter: boolean };
	private entries: Entry[] = [];
	private excluded: { path: string; rule: string }[] = [];
	private unreadable: { path: string; error: string }[] = [];
	private loadDone = 0;
	private loadTotal = 0;
	private queue: Promise<void> = Promise.resolve();
	private result: AssembleResult = { kind: "empty" };
	private closed = false;
	private summaryEl: HTMLElement | null = null;
	private listEl: HTMLElement | null = null;
	private candEl: HTMLElement | null = null;
	private sectionsEl: HTMLElement | null = null;
	private copyBtn: HTMLButtonElement | null = null;

	constructor(private readonly plugin: NoteShuttlePlugin, private readonly masker: Masker, private readonly init: PackModalInit) {
		super(plugin.app);
		const s = plugin.settings;
		this.opts = { budgetChars: s.budgetChars, tokenPerChar: s.tokenPerChar, order: s.order, keepFrontmatter: s.keepFrontmatter };
	}

	onOpen(): void {
		this.setTitle("パックの中身");
		const c = this.contentEl;
		c.addClass("note-shuttle-modal");
		this.summaryEl = c.createDiv({ cls: "ns-summary" });
		const input = c.createEl("input", { type: "search", cls: "ns-filter", attr: { placeholder: "パスで探して追加(1文字以上)" } });
		input.addEventListener("input", () => this.renderCandidates(input.value));
		this.candEl = c.createDiv({ cls: "ns-candidates" });
		this.listEl = c.createDiv({ cls: "ns-list" });
		this.sectionsEl = c.createDiv({ cls: "ns-sections" });
		const buttons = c.createDiv({ cls: "modal-button-container" });
		this.copyBtn = buttons.createEl("button", { text: "コピー", cls: "mod-cta" });
		this.copyBtn.addEventListener("click", () => this.copy());
		buttons.createEl("button", { text: "閉じる" }).addEventListener("click", () => this.close());
		this.add(this.init.files);
	}

	onClose(): void {
		this.closed = true;
		this.contentEl.empty();
	}

	/** 一覧の末尾に加える。同じノートは最初の1回だけ。除外に当たる物は一覧に入れない(FR-11・INV-5) */
	private add(files: readonly TFile[]): void {
		const fresh: Entry[] = [];
		for (const file of files) {
			const p = file.path;
			if (this.entries.some((e) => e.path === p) || this.excluded.some((x) => x.path === p) || this.unreadable.some((x) => x.path === p)) continue;
			const rule = excludeRule(this.plugin.settings, p);
			if (rule !== null) {
				this.excluded.push({ path: p, rule });
				continue;
			}
			const e: Entry = { file, path: p, mtime: file.stat.mtime, note: null, checked: true };
			this.entries.push(e);
			fresh.push(e);
		}
		this.loadTotal += fresh.length;
		this.refresh(true);
		this.queue = this.queue.then(() => this.load(fresh));
	}

	private async load(fresh: readonly Entry[]): Promise<void> {
		for (const e of fresh) {
			if (this.closed) return;
			const r = this.init.preread?.get(e.path) ?? await readNote(this.app.vault, e.file);
			if (r.ok) {
				e.mtime = r.note.mtime;
				e.note = prepareNote(r.note, this.opts.keepFrontmatter, this.masker);
			} else {
				this.entries.splice(this.entries.indexOf(e), 1);
				this.unreadable.push({ path: r.path, error: r.error });
			}
			this.loadDone++;
			this.refresh(true);
		}
	}

	private loading(): boolean {
		return this.loadDone < this.loadTotal;
	}

	private checkedNotes(): PreparedNote[] {
		return this.entries.flatMap((e) => (e.checked && e.note !== null ? [e.note] : []));
	}

	/** 組み立て直して画面を合わせる。list=false はチェックの変更だけ(一覧は作り直さない) */
	private refresh(list: boolean): void {
		if (this.closed) return;
		const checked = this.checkedNotes();
		this.result = assemble(checked, this.opts, this.masker, Date.now());
		this.renderSummary(checked);
		if (list) {
			this.renderList();
			this.renderSections();
		}
		if (this.copyBtn) this.copyBtn.disabled = this.loading() || this.result.kind !== "ok";
	}

	private renderSummary(checked: readonly PreparedNote[]): void {
		const s = this.summaryEl;
		if (!s) return;
		s.empty();
		const sum = summaryLine(checked, this.opts.tokenPerChar);
		s.createDiv({ text: `合計 ${formatNumber(sum.total)} / ${formatNumber(this.opts.budgetChars)} 文字` });
		s.createDiv({ text: `推定トークン 約${formatNumber(sum.tokens)}(概算)` });
		s.createDiv({ text: sum.mask });
		if (this.loading()) s.createDiv({ cls: "ns-status", text: `読み込み中 ${this.loadDone} / ${this.loadTotal}` });
		const r = this.result;
		if (r.kind === "empty" && !this.loading()) s.createDiv({ cls: "ns-status", text: "対象0本" });
		if (r.kind === "over") {
			s.createDiv({ cls: "ns-warn", text: `予算を ${formatNumber(r.over)} 文字超えています。チェックを外してください` });
			const ol = s.createEl("ol", { cls: "ns-breakdown" });
			for (const b of r.breakdown) ol.createEl("li", { text: `${b.path}  ${formatNumber(b.chars)}文字` });
		}
		if (r.kind === "secretInPath") s.createDiv({ cls: "ns-warn", text: `パスに伏せ字の対象があります: ${r.path}` });
		if (r.kind === "secretRemains") s.createDiv({ cls: "ns-warn", text: "パックに伏せ字の対象が残っています" });
	}

	private renderList(): void {
		const l = this.listEl;
		if (!l) return;
		l.empty();
		for (const e of orderNotes(this.entries, this.opts.order)) {
			const row = l.createEl("label", { cls: "ns-row" });
			const cb = row.createEl("input", { type: "checkbox" });
			cb.checked = e.checked;
			cb.disabled = e.note === null;
			cb.addEventListener("change", () => {
				e.checked = cb.checked;
				this.refresh(false);
			});
			row.createSpan({ cls: "ns-path", text: e.path });
			row.createSpan({ cls: "ns-meta", text: formatDateTime(e.mtime) });
			row.createSpan({ cls: "ns-meta", text: e.note ? `${formatNumber(e.note.chars)}文字` : "読み込み中" });
		}
	}

	/** 下段: 0件の見出しは出さない */
	private renderSections(): void {
		const s = this.sectionsEl;
		if (!s) return;
		s.empty();
		const section = (title: string, lines: string[]) => {
			if (lines.length === 0) return;
			s.createDiv({ cls: "ns-section-title", text: title });
			const ul = s.createEl("ul");
			for (const t of lines) ul.createEl("li", { text: t });
		};
		section("除外したノート", this.excluded.map((x) => `${x.path} — ${x.rule}`));
		section("読めなかったノート", this.unreadable.map((x) => `${x.path} — ${x.error}`));
		section("加えなかったリンク", (this.init.skippedLinks ?? []).map((x) => `${x.link} — ${x.reason}`));
	}

	/** FR-4: 1文字以上でパスに部分一致する md を候補に出す。押すと一覧の末尾に加える */
	private renderCandidates(query: string): void {
		const c = this.candEl;
		if (!c) return;
		c.empty();
		if (query.length === 0) return;
		const hits = this.app.vault.getMarkdownFiles().filter((f) => queryMatches(f.path, query))
			.sort((a, b) => comparePaths(a.path, b.path));
		if (hits.length === 0) {
			c.createDiv({ cls: "ns-empty", text: "当たるノートがありません" });
			return;
		}
		for (const f of hits) {
			c.createEl("button", { cls: "ns-candidate", text: f.path }).addEventListener("click", () => this.add([f]));
		}
	}

	/** D-19: 組み立て済みの文字列を、処理の最初で書く */
	private copy(): void {
		const r = this.result;
		if (r.kind !== "ok" || this.loading()) return;
		const masked = Object.values(r.counts).reduce((a, n) => a + n, 0);
		void copyPack(r.text, { notes: r.notes.length, chars: r.total, masked }).then((ok) => {
			if (ok) this.close();
		});
	}
}
