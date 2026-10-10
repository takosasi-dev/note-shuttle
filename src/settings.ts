// 設定の型・既定値(DEFAULTS は1か所。D-6)・固定の除外(ALWAYS_EXCLUDE。私の vault のフォルダ名はここだけ)・読み込みの補い。
// obsidian を import しない(テストで読む)。欠けた項目は既定値で埋め、schemaVersion が違う・壊れていれば既定で動く(§9.2)。
// 伏せ字の規則は6種だけを持つ。欠けた種別は既定で埋めない(INV-6 で止めるため)。
import { MASK_KINDS } from "./core/mask";
import type { MaskRule, PackOptions } from "./core/types";

export interface Settings extends PackOptions {
	schemaVersion: 1;
	neverPack: string[];
	/** FR-15 を入れたときだけ使う(今は使わない) */
	exportFolder: string;
}

/** 設定画面では変えられない(INV-5) */
export const ALWAYS_EXCLUDE: readonly string[] = [".obsidian/", ".git/", ".trash/", "copilot/skills/", ".claude/", ".agents/", ".opencode/"];

export const DEFAULTS: Settings = {
	schemaVersion: 1,
	budgetChars: 150000,                       // CLI 版 §9.2 の仮決め(Q-13)
	tokenPerChar: 1.0,                         // CLI 版 §9.2(Q-14)
	keepFrontmatter: false,                    // CLI 版 §9.3
	order: "listed",                           // FR-10
	neverPack: [],                             // Q-15: 中身は依頼者が決める。推測で入れない
	// §9.5.3 の6行を、この順・この文字列のまま(CLI 版 §9.2 [mask] のシングルクォートの中身)
	maskRules: [
		{ kind: "anthropic", pattern: "sk-ant-[A-Za-z0-9_\\-]{20,}" },
		{ kind: "openai", pattern: "sk-(?:proj-)?[A-Za-z0-9_\\-]{20,}" },
		{ kind: "github", pattern: "(?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}" },
		{ kind: "aws_key", pattern: "AKIA[0-9A-Z]{16}" },
		{ kind: "discord", pattern: "[MNO][A-Za-z0-9_\\-]{23,27}\\.[A-Za-z0-9_\\-]{6}\\.[A-Za-z0-9_\\-]{27,40}" },
		{ kind: "private_key", pattern: "-----BEGIN [A-Z ]*PRIVATE KEY-----[\\s\\S]+?-----END [A-Z ]*PRIVATE KEY-----" },
	],
	maskLiterals: [],
	exportFolder: "文脈パック",
};

function copyDefaults(): Settings {
	return JSON.parse(JSON.stringify(DEFAULTS)) as Settings;
}

const isStringList = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === "string");

/** data.json の中身を Settings にする。mismatch=true なら呼び手が Notice を出し、data.json は書き換えない */
export function normalizeSettings(raw: unknown): { settings: Settings; mismatch: boolean } {
	const base = copyDefaults();
	if (raw === null || raw === undefined) return { settings: base, mismatch: false };
	if (typeof raw !== "object" || Array.isArray(raw)) return { settings: base, mismatch: true };
	const r = raw as Record<string, unknown>;
	if (r.schemaVersion !== undefined && r.schemaVersion !== 1) return { settings: base, mismatch: true };
	const num = (v: unknown, ok: (n: number) => boolean, d: number) => (typeof v === "number" && Number.isFinite(v) && ok(v) ? v : d);
	let maskRules = base.maskRules;
	if (Array.isArray(r.maskRules)) {
		// 6種だけを §9.5.3 の順に拾う。無い種別は無いまま(INV-6 で止まる)。追加の種別は持たない(D-13)
		const given = (r.maskRules as unknown[]).filter((x): x is MaskRule =>
			typeof x === "object" && x !== null && typeof (x as MaskRule).kind === "string" && typeof (x as MaskRule).pattern === "string");
		maskRules = MASK_KINDS.flatMap((k) => {
			const hit = given.find((g) => g.kind === k);
			return hit ? [{ kind: k, pattern: hit.pattern }] : [];
		});
	}
	return {
		settings: {
			schemaVersion: 1,
			budgetChars: num(r.budgetChars, (n) => Number.isInteger(n) && n > 0, base.budgetChars),
			tokenPerChar: num(r.tokenPerChar, (n) => n >= 0, base.tokenPerChar),
			keepFrontmatter: typeof r.keepFrontmatter === "boolean" ? r.keepFrontmatter : base.keepFrontmatter,
			order: r.order === "listed" || r.order === "mtime_desc" ? r.order : base.order,
			neverPack: isStringList(r.neverPack) ? r.neverPack : base.neverPack,
			maskRules,
			maskLiterals: isStringList(r.maskLiterals) ? r.maskLiterals : base.maskLiterals,
			exportFolder: typeof r.exportFolder === "string" ? r.exportFolder : base.exportFolder,
		},
		mismatch: false,
	};
}
