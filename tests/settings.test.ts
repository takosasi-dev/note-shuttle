// 設定の読み込みの補い(§9.2)と、既定の伏せ字の規則が CLI 版仕様書と1文字も違わないこと(AC-8)。
// AC-8 は CLI 版仕様書のパスを環境変数 NS_CLI_SPEC で渡したときだけ走る(vault を読むだけ)。
import { readFileSync } from "node:fs";
import { env } from "node:process";
import { describe, expect, it } from "vitest";
import { compileMasker, MASK_KINDS } from "../src/core/mask";
import { DEFAULTS, normalizeSettings } from "../src/settings";

describe("設定の読み込み(§9.2)", () => {
	it("data.json が無ければ既定", () => {
		expect(normalizeSettings(null)).toEqual({ settings: DEFAULTS, mismatch: false });
	});
	it("欠けた項目は既定で埋め、型の違う項目は既定に戻す", () => {
		const { settings, mismatch } = normalizeSettings({ budgetChars: 1000, order: "random", neverPack: ["secret/**"], tokenPerChar: "x" });
		expect(mismatch).toBe(false);
		expect(settings.budgetChars).toBe(1000);
		expect(settings.order).toBe("listed");
		expect(settings.neverPack).toEqual(["secret/**"]);
		expect(settings.tokenPerChar).toBe(1);
		expect(settings.maskRules).toEqual(DEFAULTS.maskRules);
	});
	it("schemaVersion が違う・壊れている(配列や文字列)なら既定で動き、知らせる", () => {
		for (const raw of [{ schemaVersion: 2, budgetChars: 5 }, "壊れた", [1, 2]]) {
			expect(normalizeSettings(raw)).toEqual({ settings: DEFAULTS, mismatch: true });
		}
	});
	it("伏せ字の規則は6種だけを §9.5.3 の順に拾い、欠けた種別は埋めない(INV-6 で止める)", () => {
		const given = [{ kind: "extra", pattern: "x" }, ...DEFAULTS.maskRules.filter((r) => r.kind !== "openai").reverse()];
		const { settings } = normalizeSettings({ maskRules: given });
		expect(settings.maskRules.map((r) => r.kind)).toEqual(MASK_KINDS.filter((k) => k !== "openai"));
		expect(compileMasker(settings.maskRules, [])).toEqual({ ok: false, kind: "openai" });
	});
	it("neverPack の既定は空(Q-15: 推測で入れない)", () => {
		expect(DEFAULTS.neverPack).toEqual([]);
	});
});

const cliSpec = env.NS_CLI_SPEC;

describe.skipIf(!cliSpec)("AC-8: DEFAULTS.maskRules と CLI 版仕様書 §9.2 [mask] の6行", () => {
	it("6件とも1文字も違わない", () => {
		const text = readFileSync(cliSpec ?? "", "utf8").replace(/\r\n/g, "\n");
		const start = text.indexOf("\n[mask]\n");
		expect(start).toBeGreaterThan(0);
		const block = text.slice(start, text.indexOf("```", start));
		const found = MASK_KINDS.map((kind) => {
			const m = new RegExp(`^${kind}\\s*=\\s*'(.*)'\\s*$`, "m").exec(block);
			return { kind, pattern: m?.[1] ?? null };
		});
		expect(found).toEqual(DEFAULTS.maskRules);
	});
});
