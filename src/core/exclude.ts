// 除外の判定(FR-11・INV-5): 固定の除外(フォルダの頭)と neverPack の glob。当たった規則の文字列を返す。
// 固定の除外の中身は settings.ts の ALWAYS_EXCLUDE(D-6)。ここは受け取るだけ。
import { matchGlob } from "./glob";

/** 当たった規則(固定の除外ならその項目、neverPack なら glob)。当たらなければ null */
export function excludedBy(path: string, always: readonly string[], neverPack: readonly string[]): string | null {
	for (const a of always) {
		if (matchGlob(path, a.endsWith("/") ? a + "**" : a + "/**")) return a;
	}
	for (const g of neverPack) {
		if (g !== "" && matchGlob(path, g)) return g;
	}
	return null;
}
