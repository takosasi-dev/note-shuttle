// 組み立て: 1本ずつ 整形 → 伏せ字 → 数える、束ねて 予算 → パック文字列(§9.5.1 = CLI 版 §9.4)→ 最終確認(INV-2)。
// 予算超過・対象0本・規則不正・パスに伏せ字の対象 のどれかなら文字列を返さない(INV-4・INV-6・FR-17)。
// 時刻は呼び手が渡す(テストで固定するため)。日時は端末の時刻で YYYY-MM-DD HH:MM。
import { codePoints, estimateTokens, formatNumber, judgeBudget } from "./count";
import { formatNote } from "./format";
import { addCounts, compileMasker, findHits, maskSummary, maskText, type Masker } from "./mask";
import { orderNotes } from "./paths";
import type { MaskCounts, Order, PackOptions, PreparedNote, SourceNote } from "./types";

/** Q-10(a): 見出しの名前(CLI 版の出力ファイル名の adhoc に合わせた) */
export const PACK_TITLE = "adhoc";

const HEADER_NOTE = "このファイルは Obsidian vault のノートを束ねたもの。各 <note> の path は vault 直下からの相対パス、updated は最終更新日時。埋め込み・画像は [埋め込み: 名前] に置き換えてある。";

const pad = (n: number) => String(n).padStart(2, "0");

/** 端末の時刻で YYYY-MM-DD HH:MM(24時間、0埋め) */
export function formatDateTime(ms: number): string {
	const d = new Date(ms);
	return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function prepareNote(src: SourceNote, keepFrontmatter: boolean, masker: Masker): PreparedNote {
	const masked = maskText(formatNote(src.text, keepFrontmatter), masker);
	return { path: src.path, mtime: src.mtime, body: masked.text, chars: codePoints(masked.text), counts: masked.counts };
}

export function totalCounts(notes: readonly PreparedNote[]): MaskCounts {
	return notes.reduce((acc, n) => addCounts(acc, n.counts), {} as MaskCounts);
}

/** 上段・生成行に使う数(画面と同じ物を出すため export) */
export function summaryLine(notes: readonly PreparedNote[], tokenPerChar: number): { total: number; tokens: number; mask: string } {
	const total = notes.reduce((a, n) => a + n.chars, 0);
	return { total, tokens: estimateTokens(total, tokenPerChar), mask: maskSummary(totalCounts(notes)) };
}

/** パック文字列。notes は出す順に並んでいること */
export function emitPack(notes: readonly PreparedNote[], tokenPerChar: number, now: number): string {
	const s = summaryLine(notes, tokenPerChar);
	const lines = [
		"<!-- NoteShuttle pack v1 -->",
		`# 文脈パック: ${PACK_TITLE}`,
		"",
		`生成: ${formatDateTime(now)} / ノート ${formatNumber(notes.length)}本 / ${formatNumber(s.total)}文字 / 推定トークン 約${formatNumber(s.tokens)}(概算) / ${s.mask}`,
		"",
		HEADER_NOTE,
		"",
		"| # | path | updated | 文字数 |",
		"|---|---|---|---|",
		...notes.map((n, i) => `| ${i + 1} | ${n.path} | ${formatDateTime(n.mtime)} | ${formatNumber(n.chars)} |`),
	];
	// Q-10(d): </note> の前に改行1つ、</note> と次の <note の間は空行1行
	const blocks = notes.map((n) => `<note path="${n.path}" updated="${formatDateTime(n.mtime)}">\n${n.body}\n</note>\n`);
	return lines.join("\n") + "\n\n" + blocks.join("\n");
}

export type AssembleResult =
	| { kind: "ok"; text: string; notes: PreparedNote[]; total: number; counts: MaskCounts }
	| { kind: "empty" }
	| { kind: "over"; total: number; budget: number; over: number; breakdown: { path: string; chars: number }[] }
	| { kind: "secretInPath"; path: string }
	| { kind: "secretRemains" };

export interface AssembleOptions {
	budgetChars: number;
	tokenPerChar: number;
	order: Order;
}

/** チェックの入ったノートから組み立てる。ノートは読み直さない(§9.4) */
export function assemble(prepared: readonly PreparedNote[], opts: AssembleOptions, masker: Masker, now: number): AssembleResult {
	if (prepared.length === 0) return { kind: "empty" };
	const notes = orderNotes(prepared, opts.order);
	const budget = judgeBudget(notes, opts.budgetChars);
	if (!budget.ok) return { kind: "over", total: budget.total, budget: opts.budgetChars, over: budget.over, breakdown: budget.breakdown };
	const text = emitPack(notes, opts.tokenPerChar, now);
	// INV-2: 組み上がった全文へ全規則をもう一度かけ、1件でも当たればコピーしない
	if (findHits(text, masker).length > 0) {
		const bad = notes.find((n) => findHits(n.path, masker).length > 0);
		return bad ? { kind: "secretInPath", path: bad.path } : { kind: "secretRemains" };
	}
	return { kind: "ok", text, notes, total: budget.total, counts: totalCounts(notes) };
}

export type BuildResult = AssembleResult | { kind: "invalidRule"; ruleKind: string };

/** 読んだノート一式から一気に組み立てる(FR-1 と検体のテスト) */
export function buildPack(sources: readonly SourceNote[], opts: PackOptions, now: number): BuildResult {
	const c = compileMasker(opts.maskRules, opts.maskLiterals);
	if (!c.ok) return { kind: "invalidRule", ruleKind: c.kind };
	const prepared = sources.map((s) => prepareNote(s, opts.keepFrontmatter, c.masker));
	return assemble(prepared, opts, c.masker, now);
}
