// FR-16 クリップボード実測(開発用。§8.4 を測るためだけ。Phase 4 で消す)。
// (a) 組み立て済みの文字列をボタンで書く (b) vault.read() を1回 await した後に書く。成否・所要ミリ秒・typeof navigator.share を出す。
// 書くのは試験用の文字列だけで、ノートの本文はクリップボードに出さない(INV-2)。
import { Modal, type App, type TFile } from "obsidian";
import { writeNow } from "./clipboard";
import { formatNumber } from "./core/count";
import { errorName } from "./read";
import { activeMarkdown } from "./select";
import { MEASURE_SIZES, measureText } from "./measure-text";

export class MeasureModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen(): void {
		this.setTitle("クリップボード実測(開発用)");
		const c = this.contentEl;
		c.addClass("note-shuttle-measure");
		c.createDiv({ text: `typeof navigator.share: ${typeof navigator.share}` });
		const readTarget: TFile | null = activeMarkdown(this.app) ?? this.app.vault.getMarkdownFiles()[0] ?? null;
		c.createDiv({ text: `(b) で読むノート: ${readTarget ? readTarget.path : "無し"}` });
		for (const size of MEASURE_SIZES) {
			const text = measureText(size);                       // (a) は押す前に組み立てておく
			const row = c.createDiv({ cls: "ns-measure-row" });
			row.createSpan({ text: `${formatNumber(size)} 文字` });
			const out = row.createSpan({ cls: "ns-measure-result" });
			const show = (label: string, t0: number, p: Promise<void>) => p.then(
				() => out.setText(`${label} 成功 ${Math.round(performance.now() - t0)}ms`),
				(e: unknown) => out.setText(`${label} 失敗 ${errorName(e)} ${Math.round(performance.now() - t0)}ms`),
			);
			row.createEl("button", { text: "組み立て済みで書く(a)" }).addEventListener("click", () => {
				const t0 = performance.now();
				void show("(a)", t0, writeNow(text));
			});
			const b = row.createEl("button", { text: "読んだ後に書く(b)" });
			b.disabled = readTarget === null;
			b.addEventListener("click", () => {
				if (readTarget === null) return;
				const t0 = performance.now();
				void show("(b)", t0, this.app.vault.read(readTarget).then(() => writeNow(text)));
			});
		}
	}

	onClose(): void {
		this.contentEl.empty();
	}
}
