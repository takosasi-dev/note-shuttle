// Note Shuttle の入口: コマンド(§9.3。measure-clipboard は開発用で Phase 4 で消す)・設定の読み書き・設定タブ。
// 書くのは saveData() とクリップボードだけ(INV-1)。パックのコマンドは伏せ字の規則を先に確かめ、不正ならパックを作らない(INV-6)。
// FR-1 は予算内で除外・読めない物が無ければモーダルを出さずにコピーし、それ以外と書き込みの失敗はモーダルを開く。
import { Notice, Plugin } from "obsidian";
import { copyPack } from "./clipboard";
import { assemble, prepareNote } from "./core/emit";
import { compileMasker, type Masker } from "./core/mask";
import { MeasureModal } from "./measure";
import { PackModal, type PackModalInit } from "./modal";
import { readNote } from "./read";
import { activeMarkdown, excludeRule, filesInFolder, FolderPicker, NOT_MARKDOWN, withLinks } from "./select";
import { normalizeSettings, type Settings } from "./settings";
import { NoteShuttleSettingTab } from "./settings-tab";

export default class NoteShuttlePlugin extends Plugin {
	settings!: Settings;

	async onload(): Promise<void> {
		await this.loadSettings();
		this.addSettingTab(new NoteShuttleSettingTab(this.app, this));
		this.addCommand({ id: "copy-current-note", name: "今のノートをパックしてコピー", callback: () => void this.copyCurrent() });
		this.addCommand({ id: "pack-current-with-links", name: "今のノートとリンク先をパック", callback: () => this.packWithLinks() });
		this.addCommand({ id: "pack-folder", name: "フォルダを選んでパック", callback: () => this.packFolder() });
		this.addCommand({ id: "pack-picked-notes", name: "ノートを選んでパック", callback: () => this.openPack({ files: [] }) });
		this.addCommand({ id: "measure-clipboard", name: "クリップボード実測(開発用)", callback: () => new MeasureModal(this.app).open() });
	}

	async loadSettings(): Promise<void> {
		let raw: unknown = null;
		let broken = false;
		try {
			raw = await this.loadData();
		} catch {
			broken = true;
		}
		const { settings, mismatch } = normalizeSettings(raw);
		this.settings = settings;
		// §9.2: 既定値で動かし、data.json は上書きしない
		if (broken || mismatch) new Notice("Note Shuttle: 設定(data.json)を読めないため既定値で動きます。data.json は書き換えていません");
	}

	async saveSettings(): Promise<void> {
		await this.saveData(this.settings);
	}

	/** 伏せ字の規則を確かめる。不正なら Notice を出して null(INV-6) */
	private masker(): Masker | null {
		const c = compileMasker(this.settings.maskRules, this.settings.maskLiterals);
		if (c.ok) return c.masker;
		new Notice(`伏せ字の規則が不正です: ${c.kind}`);
		return null;
	}

	private openPack(init: PackModalInit): void {
		const m = this.masker();
		if (m) new PackModal(this, m, init).open();
	}

	/** FR-1 */
	private async copyCurrent(): Promise<void> {
		const file = activeMarkdown(this.app);
		if (!file) {
			new Notice(NOT_MARKDOWN);
			return;
		}
		const masker = this.masker();
		if (!masker) return;
		if (excludeRule(this.settings, file.path) !== null) {
			new PackModal(this, masker, { files: [file] }).open();
			return;
		}
		const read = await readNote(this.app.vault, file);
		if (read.ok) {
			const r = assemble([prepareNote(read.note, this.settings.keepFrontmatter, masker)], this.settings, masker, Date.now());
			if (r.kind === "ok") {
				const masked = Object.values(r.counts).reduce((a, n) => a + n, 0);
				if (await copyPack(r.text, { notes: 1, chars: r.total, masked })) return;
			}
		}
		new PackModal(this, masker, { files: [file], preread: new Map([[file.path, read]]) }).open();
	}

	/** FR-2 */
	private packWithLinks(): void {
		const file = activeMarkdown(this.app);
		if (!file) {
			new Notice(NOT_MARKDOWN);
			return;
		}
		const { files, skipped } = withLinks(this.app, file);
		this.openPack({ files, skippedLinks: skipped });
	}

	/** FR-3 */
	private packFolder(): void {
		const m = this.masker();
		if (!m) return;
		new FolderPicker(this.app, (folder) => new PackModal(this, m, { files: filesInFolder(this.app, folder) }).open()).open();
	}
}
