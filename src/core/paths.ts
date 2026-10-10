// パスの並べ方と選び方の純関数: コードポイント順(Python の文字列の並びと同じ)・FR-10 の並び順・
// FR-3 のフォルダの一覧と配下・FR-4 の絞り込み(NFC にそろえ、大文字小文字を区別しない)。
import type { Order } from "./types";

/** コードポイント順。JS の既定の比較は UTF-16 の単位なので、U+E000 以上と絵文字で順が変わる */
export function comparePaths(a: string, b: string): number {
	let i = 0;
	let j = 0;
	while (i < a.length && j < b.length) {
		const x = a.codePointAt(i) ?? 0;
		const y = b.codePointAt(j) ?? 0;
		if (x !== y) return x < y ? -1 : 1;
		i += x > 0xffff ? 2 : 1;
		j += y > 0xffff ? 2 : 1;
	}
	if (i < a.length) return 1;
	return j < b.length ? -1 : 0;
}

/** FR-10: listed は一覧の順、mtime_desc は更新が新しい順(同じならパスのコードポイント順) */
export function orderNotes<T extends { path: string; mtime: number }>(notes: readonly T[], order: Order): T[] {
	if (order === "listed") return [...notes];
	return [...notes].sort((a, b) => (b.mtime - a.mtime) || comparePaths(a.path, b.path));
}

/** FR-3: 各パスの親フォルダとその上のフォルダ。vault 直下は出さない */
export function foldersOf(paths: readonly string[]): string[] {
	const set = new Set<string>();
	for (const p of paths) {
		let k = p.lastIndexOf("/");
		while (k > 0) {
			const f = p.slice(0, k);
			if (set.has(f)) break;
			set.add(f);
			k = f.lastIndexOf("/");
		}
	}
	return [...set].sort(comparePaths);
}

/** FR-3: フォルダの配下(サブフォルダを含む)のパスをコードポイント順で */
export function pathsInFolder(paths: readonly string[], folder: string): string[] {
	const prefix = folder + "/";
	return paths.filter((p) => p.startsWith(prefix)).sort(comparePaths);
}

/** FR-4: 部分一致。両側を NFC にし、大文字小文字を区別しない。空の問い合わせは何にも当たらない */
export function queryMatches(path: string, query: string): boolean {
	const q = query.normalize("NFC").toLowerCase();
	return q.length > 0 && path.normalize("NFC").toLowerCase().includes(q);
}
