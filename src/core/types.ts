// core の共有の型。obsidian を import しない(D-5)。
// ノートは「パス・更新時刻・読んだ文字列」だけで受け取り、TFile には触らない。

/** 伏せ字の規則(§9.2)。pattern は JavaScript の正規表現(フラグ g だけで使う) */
export interface MaskRule {
	kind: string;
	pattern: string;
}

export type Order = "listed" | "mtime_desc";

/** 組み立てに要る設定(Settings の一部) */
export interface PackOptions {
	budgetChars: number;
	tokenPerChar: number;
	keepFrontmatter: boolean;
	order: Order;
	maskRules: MaskRule[];
	maskLiterals: string[];
}

/** 読んだノート1本。mtime はミリ秒(TFile.stat.mtime) */
export interface SourceNote {
	path: string;
	mtime: number;
	text: string;
}

/** 種別名 → 伏せた件数。literals は "literal" */
export type MaskCounts = Record<string, number>;

/** 整形・伏せ字の後のノート。chars は body のコードポイント数(D-14) */
export interface PreparedNote {
	path: string;
	mtime: number;
	body: string;
	chars: number;
	counts: MaskCounts;
}
