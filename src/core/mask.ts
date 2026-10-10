// 伏せ字(§9.5.3 = CLI 版 §9.2 [mask] と §9.6): 6種の正規表現と literals の一致を [MASKED:<種別>] に置き換える。
// 一致は開始位置の早い順、同じなら長い順、それも同じなら §9.5.3 の上の規則(Q-11)。先に採った物と重なる一致は捨てる。
// 6種のどれかが無い・空・不正なら compileMasker が失敗を返す(INV-6)。
import { formatNumber } from "./count";
import type { MaskCounts, MaskRule } from "./types";

/** §9.5.3 の順。件数の書き方もこの順で、literal は最後(Q-10(c)) */
export const MASK_KINDS = ["anthropic", "openai", "github", "aws_key", "discord", "private_key"] as const;
export const LITERAL_KIND = "literal";

export interface Masker {
	rules: { kind: string; re: RegExp }[];
	literals: string[];
}

export type CompileResult = { ok: true; masker: Masker } | { ok: false; kind: string };

/** 6種をこの順で組み立てる。最初に見つかった不正な種別を返す */
export function compileMasker(rules: readonly MaskRule[], literals: readonly string[]): CompileResult {
	const out: Masker["rules"] = [];
	for (const kind of MASK_KINDS) {
		const pattern = rules.find((r) => r.kind === kind)?.pattern ?? "";
		if (pattern.trim() === "") return { ok: false, kind };
		try {
			out.push({ kind, re: new RegExp(pattern, "g") });
		} catch {
			return { ok: false, kind };
		}
	}
	return { ok: true, masker: { rules: out, literals: literals.filter((l) => l !== "") } };
}

export interface Hit {
	start: number;
	end: number;
	kind: string;
}

/** 採る一致を開始位置の順で返す(位置は UTF-16 の単位。§9.5.3 のとおり比べ方はどちらでも同じ順になる) */
export function findHits(text: string, m: Masker): Hit[] {
	const all: (Hit & { rank: number })[] = [];
	m.rules.forEach(({ kind, re }, rank) => {
		const r = new RegExp(re.source, re.flags);
		let x: RegExpExecArray | null;
		while ((x = r.exec(text)) !== null) {
			if (x[0].length === 0) {
				r.lastIndex++;
				continue;
			}
			all.push({ start: x.index, end: x.index + x[0].length, kind, rank });
		}
	});
	m.literals.forEach((lit, i) => {
		for (let at = text.indexOf(lit); at >= 0; at = text.indexOf(lit, at + 1)) {
			all.push({ start: at, end: at + lit.length, kind: LITERAL_KIND, rank: m.rules.length + i });
		}
	});
	all.sort((a, b) => (a.start - b.start) || ((b.end - b.start) - (a.end - a.start)) || (a.rank - b.rank));
	const picked: Hit[] = [];
	let end = 0;
	for (const h of all) {
		if (h.start < end) continue;
		picked.push({ start: h.start, end: h.end, kind: h.kind });
		end = h.end;
	}
	return picked;
}

export function maskText(text: string, m: Masker): { text: string; counts: MaskCounts } {
	const counts: MaskCounts = {};
	let out = "";
	let at = 0;
	for (const h of findHits(text, m)) {
		out += text.slice(at, h.start) + `[MASKED:${h.kind}]`;
		counts[h.kind] = (counts[h.kind] ?? 0) + 1;
		at = h.end;
	}
	return { text: out + text.slice(at), counts };
}

export function addCounts(into: MaskCounts, add: MaskCounts): MaskCounts {
	for (const [k, v] of Object.entries(add)) into[k] = (into[k] ?? 0) + v;
	return into;
}

/** `伏せ字 0件` / `伏せ字 3件(discord 2, github 1)`(§9.5.3 の順、literal は最後。Q-10(c)) */
export function maskSummary(counts: MaskCounts): string {
	const fmt = formatNumber;
	const order = [...MASK_KINDS, LITERAL_KIND];
	const parts = order.filter((k) => (counts[k] ?? 0) > 0).map((k) => `${k} ${fmt(counts[k] ?? 0)}`);
	const total = order.reduce((a, k) => a + (counts[k] ?? 0), 0);
	return parts.length ? `伏せ字 ${fmt(total)}件(${parts.join(", ")})` : `伏せ字 ${fmt(total)}件`;
}
