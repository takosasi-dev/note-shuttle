// FR-16 の試験用文字列(開発用。Phase 4 で measure.ts と一緒に消す)。obsidian を import しない。
// `NS-TEST <文字数> START` で始まり `NS-TEST <文字数> END` で終わり、中は日本語と 🕒 を混ぜる。全体がちょうど <文字数> コードポイント。

export const MEASURE_SIZES = [10000, 50000, 100000, 150000] as const;

const FILL = Array.from("🕒 クリップボードの実測用の行です。日本語と English を混ぜる。\n");

export function measureText(n: number): string {
	const head = `NS-TEST ${n} START\n`;
	const tail = `\nNS-TEST ${n} END`;
	const need = n - Array.from(head).length - Array.from(tail).length;
	const body: string[] = [];
	for (let i = 0; i < need; i++) body.push(FILL[i % FILL.length] ?? "");
	return head + body.join("") + tail;
}
