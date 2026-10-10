// core の純関数のテスト: 整形(AC-3)・数え方(AC-4)・予算(AC-5)・伏せ字(AC-6・AC-7)・規則不正(AC-9)・パスの伏せ字(AC-27)、
// glob と除外(FR-11)・パスの並びと絞り込み(FR-3・FR-4・FR-10)・対象0本(FR-17)。秘密の形はすべて偽物。
import { describe, expect, it } from "vitest";
import { codePoints, estimateTokens, formatNumber, judgeBudget } from "../src/core/count";
import { assemble, buildPack, formatDateTime, prepareNote } from "../src/core/emit";
import { excludedBy } from "../src/core/exclude";
import { formatNote } from "../src/core/format";
import { matchGlob } from "../src/core/glob";
import { compileMasker, findHits, maskSummary, maskText, type Masker } from "../src/core/mask";
import { comparePaths, foldersOf, orderNotes, pathsInFolder, queryMatches } from "../src/core/paths";
import type { MaskRule, PackOptions } from "../src/core/types";
import { measureText } from "../src/measure-text";
import { ALWAYS_EXCLUDE, DEFAULTS } from "../src/settings";
import { FAKES } from "./fakes";

const NOW = new Date(2026, 9, 10, 12, 30).getTime();
const opts = (o: Partial<PackOptions> = {}): PackOptions => ({ ...JSON.parse(JSON.stringify(DEFAULTS)) as PackOptions, ...o });
const masker = (literals: string[] = []): Masker => {
	const c = compileMasker(DEFAULTS.maskRules, literals);
	if (!c.ok) throw new Error("既定の規則が不正");
	return c.masker;
};

/** §8.5 の形の偽の値(本物ではない)。鍵の形の物は fakes.ts が実行時に組み立てる */
const FAKE: Record<string, string> = {
	anthropic: FAKES.anthropic,
	openai: FAKES.openai,
	github: FAKES.github,
	aws_key: FAKES.aws_key,
	discord: FAKES.discord,
	private_key: FAKES.private_key,
	literal: "東京都架空区1-2-3",
};

describe("整形(AC-3: §9.5.2 の8行)", () => {
	it("1. frontmatter を削る / keepFrontmatter なら残す", () => {
		const t = "---\na: 1\n---\n本文";
		expect(formatNote(t, false)).toBe("本文");
		expect(formatNote(t, true)).toBe(t);
		expect(formatNote("本文\n---\na: 1\n---\n", false)).toBe("本文\n---\na: 1\n---");   // 先頭でなければ削らない
	});
	it("2. 画像の ![[x.png]] と ![alt](path) → [画像: x.png]", () => {
		expect(formatNote("![[x.png]] ![[a/y.JPEG|200]] ![[z.svg]]", false)).toBe("[画像: x.png] [画像: a/y.JPEG] [画像: z.svg]");
		expect(formatNote("![図](img/x.gif) ![](<a b.webp>) ![t](p.jpg \"題\")", false)).toBe("[画像: img/x.gif] [画像: a b.webp] [画像: p.jpg]");
		expect(formatNote("[x.png](x.png) と ![md](note.md)", false)).toBe("[x.png](x.png) と ![md](note.md)");
	});
	it("3. ノート埋め込み → [埋め込み: ノート名]", () => {
		expect(formatNote("![[ノート]] ![[ノート#見出し|別名]] ![[資料.pdf]]", false)).toBe("[埋め込み: ノート] [埋め込み: ノート#見出し] [埋め込み: 資料.pdf]");
	});
	it("4. dataview / dataviewjs / base のブロック → [Dataviewクエリ省略]", () => {
		const t = "前\n```dataview\nLIST\n```\n```dataviewjs\ndv.x()\n```\n```base\nfilters: []\n```\n```js\nkeep\n```\n後";
		expect(formatNote(t, false)).toBe("前\n[Dataviewクエリ省略]\n[Dataviewクエリ省略]\n[Dataviewクエリ省略]\n```js\nkeep\n```\n後");
	});
	it("5. %% コメント %% を削る(複数行も)", () => {
		expect(formatNote("a %%b%% c\n%%\nx\ny\n%%\nd", false)).toBe("a  c\n\nd");
		expect(formatNote("閉じない %% はそのまま", false)).toBe("閉じない %% はそのまま");
	});
	it("6. 本文中の </note> → <\\/note>", () => {
		expect(formatNote("a </note> b </note>", false)).toBe("a <\\/note> b <\\/note>");
	});
	it("7. 3行以上続く空行 → 2行(2行はそのまま)", () => {
		expect(formatNote("a\n\n\n\nb\n\n\nc\n\n\n\n\n\nd", false)).toBe("a\n\n\nb\n\n\nc\n\n\nd");
		expect(formatNote("\n\n\n\na", false)).toBe("\n\na");
	});
	it("8. wiki リンクはそのまま", () => {
		expect(formatNote("[[a|b]] [[c]] [[d#e]]", false)).toBe("[[a|b]] [[c]] [[d#e]]");
	});
	it("Q-10(d)(e): BOM と CRLF をそろえ、末尾の改行を削る", () => {
		expect(formatNote("\uFEFF---\r\nx: 1\r\n---\r\nA\r\nB\r\n\r\n", false)).toBe("A\nB");
	});
});

describe("数え方(AC-4・D-14)", () => {
	it("🕒 は 1、`### 🕒 [12:10] 見出し` は 17(String.length なら 18)", () => {
		expect(codePoints("🕒")).toBe(1);
		expect(codePoints("### 🕒 [12:10] 見出し")).toBe(17);
		expect("### 🕒 [12:10] 見出し".length).toBe(18);
	});
	it("数は3桁ごとに半角カンマ、推定トークンは 1,000 単位に四捨五入", () => {
		expect([0, 999, 1000, 84213, 1234567].map(formatNumber)).toEqual(["0", "999", "1,000", "84,213", "1,234,567"]);
		expect([estimateTokens(84213, 1), estimateTokens(499, 1), estimateTokens(500, 1), estimateTokens(10000, 0.8)]).toEqual([84000, 0, 1000, 8000]);
	});
	it("日時は端末の時刻で YYYY-MM-DD HH:MM", () => {
		expect(formatDateTime(new Date(2026, 0, 2, 3, 4).getTime())).toBe("2026-01-02 03:04");
	});
});

describe("予算(AC-5・FR-8・INV-4)", () => {
	const m = masker();
	const notes = [
		prepareNote({ path: "s.md", mtime: 0, text: "あいう" }, false, m),
		prepareNote({ path: "l.md", mtime: 0, text: "🕒".repeat(10) }, false, m),
		prepareNote({ path: "m.md", mtime: 0, text: "12345" }, false, m),
	];
	const total = 3 + 10 + 5;
	it("合計 −1 ではコピー不可・超過1文字・大きい順の内訳", () => {
		const r = assemble(notes, { budgetChars: total - 1, tokenPerChar: 1, order: "listed" }, m, NOW);
		expect(r).toEqual({ kind: "over", total, budget: total - 1, over: 1,
			breakdown: [{ path: "l.md", chars: 10 }, { path: "m.md", chars: 5 }, { path: "s.md", chars: 3 }] });
	});
	it("合計ちょうどならコピー可", () => {
		const r = assemble(notes, { budgetChars: total, tokenPerChar: 1, order: "listed" }, m, NOW);
		expect(r.kind).toBe("ok");
	});
	it("judgeBudget は同じ文字数なら元の順", () => {
		expect(judgeBudget([{ path: "a", chars: 1 }, { path: "b", chars: 1 }], 5).breakdown.map((b) => b.path)).toEqual(["a", "b"]);
	});
	it("対象0本は組み立てない(FR-17)", () => {
		expect(assemble([], { budgetChars: 10, tokenPerChar: 1, order: "listed" }, m, NOW)).toEqual({ kind: "empty" });
	});
});

describe("伏せ字(AC-6・AC-7・FR-7・INV-2)", () => {
	it("AC-6: 6種と literal が1件ずつ伏せられ、元の文字列が残らない", () => {
		const body = Object.entries(FAKE).map(([k, v]) => `${k}: ${v}`).join("\n");
		const r = maskText(body, masker([FAKE.literal ?? ""]));
		for (const v of Object.values(FAKE)) expect(r.text.includes(v)).toBe(false);
		for (const k of Object.keys(FAKE)) expect(r.text.split(`[MASKED:${k}]`).length - 1).toBe(1);
		expect(r.counts).toEqual({ anthropic: 1, openai: 1, github: 1, aws_key: 1, discord: 1, private_key: 1, literal: 1 });
		expect(maskSummary(r.counts)).toBe("伏せ字 7件(anthropic 1, openai 1, github 1, aws_key 1, discord 1, private_key 1, literal 1)");
		expect(maskSummary({})).toBe("伏せ字 0件");
	});
	it("コードブロックの中にもかける(§9.5.3)", () => {
		expect(maskText("```\nkey=AKIA0123456789ABCDEF\n```", masker()).text).toBe("```\nkey=[MASKED:aws_key]\n```");
	});
	it("AC-7: 開始位置の早い方 → 同じなら長い方 → それも同じなら上の規則(Q-11: sk-ant- は anthropic)", () => {
		const m = masker(["東京", "京都府", "大阪", "大阪府"]);
		expect(maskText("東京都府", m).text).toBe("[MASKED:literal]都府");          // 早い方(東京)を採り、重なる 京都府 は捨てる
		expect(maskText("大阪府", m).text).toBe("[MASKED:literal]");               // 同じ位置なら長い方(大阪府)
		const hits = findHits(FAKE.anthropic ?? "", m);
		expect(hits).toEqual([{ start: 0, end: (FAKE.anthropic ?? "").length, kind: "anthropic" }]);
		// 規則だけを見ると openai も同じ位置・同じ長さで当たる(だから Q-11 が要る)
		expect(new RegExp(DEFAULTS.maskRules[1]?.pattern ?? "", "g").exec(FAKE.anthropic ?? "")?.[0]).toBe(FAKE.anthropic);
	});
	it("literal は大文字小文字を区別する", () => {
		expect(maskText("Secret secret", masker(["secret"])).text).toBe("Secret [MASKED:literal]");
	});
});

describe("規則不正(AC-9・INV-6)", () => {
	const src = [{ path: "a.md", mtime: 0, text: "本文" }];
	const without = (kind: string): MaskRule[] => DEFAULTS.maskRules.filter((r) => r.kind !== kind);
	const replace = (kind: string, pattern: string): MaskRule[] => DEFAULTS.maskRules.map((r) => (r.kind === kind ? { kind, pattern } : r));
	it.each([
		["欠けている", without("discord"), "discord"],
		["空", replace("github", "  "), "github"],
		["( を含む不正な正規表現", replace("openai", DEFAULTS.maskRules[1]?.pattern + "("), "openai"],
	])("%s → 規則不正を返し、パック文字列を返さない", (_label, rules, kind) => {
		const r = buildPack(src, opts({ maskRules: rules }), NOW);
		expect(r).toEqual({ kind: "invalidRule", ruleKind: kind });
		expect("text" in r).toBe(false);
	});
});

describe("パスの伏せ字(AC-27・INV-2 の最終確認)", () => {
	it("パスに AKIA + 16文字があれば、パスに伏せ字の対象を返し、文字列を返さない", () => {
		const path = "鍵/AKIAABCDEFGHIJKLMNOP.md";
		const r = buildPack([{ path, mtime: 0, text: "本文" }], opts(), NOW);
		expect(r).toEqual({ kind: "secretInPath", path });
	});
	it("本文に残った物も止める(literal が見出しの文字列に当たる)", () => {
		const r = buildPack([{ path: "a.md", mtime: 0, text: "本文" }], opts({ maskLiterals: ["文脈パック"] }), NOW);
		expect(r).toEqual({ kind: "secretRemains" });
	});
});

describe("glob と除外(FR-11・INV-5・Q-10(g))", () => {
	it("* は / を越えず、** は越える、? は1文字。大文字小文字を区別しない", () => {
		expect(matchGlob("secret/n.md", "secret/**")).toBe(true);
		expect(matchGlob("SECRET/sub/N.md", "secret/**")).toBe(true);
		expect(matchGlob("secrets/n.md", "secret/**")).toBe(false);
		expect(matchGlob("a/b.md", "*.md")).toBe(false);
		expect(matchGlob("b.md", "*.md")).toBe(true);
		expect(matchGlob("家計/x/明細1.md", "家計/**/明細*")).toBe(true);
		expect(matchGlob("a1.md", "a?.md")).toBe(true);
		expect(matchGlob("a/.md", "a?.md")).toBe(false);
		expect(matchGlob("a+(b).md", "a+(b).md")).toBe(true);
	});
	it("NFD のパスも NFC の glob に当たる", () => {
		expect(matchGlob("プロジェクト/x.md".normalize("NFD"), "プロジェクト/**")).toBe(true);
	});
	it("固定の除外はフォルダの頭で当て、当たった規則を返す", () => {
		expect(excludedBy("copilot/skills/x/SKILL.md", ALWAYS_EXCLUDE, [])).toBe("copilot/skills/");
		expect(excludedBy("copilot/memo.md", ALWAYS_EXCLUDE, [])).toBeNull();
		expect(excludedBy("secret/n.md", ALWAYS_EXCLUDE, ["secret/**"])).toBe("secret/**");
		expect(excludedBy("note.md", ALWAYS_EXCLUDE, ["secret/**"])).toBeNull();
	});
});

describe("パスの並びと絞り込み(FR-3・FR-4・FR-10)", () => {
	it("コードポイント順(UTF-16 の順と違う所)", () => {
		const a = "！.md";   // U+FF01
		const b = "😀.md";       // U+1F600
		expect([b, a].sort(comparePaths)).toEqual([a, b]);
		expect([b, a].sort()).toEqual([b, a]);  // 既定の比較は UTF-16 の単位なので逆になる
		expect(["b", "a", "ab", "B"].sort(comparePaths)).toEqual(["B", "a", "ab", "b"]);
	});
	it("AC-13 の core 側: フォルダの配下をコードポイント順で", () => {
		const md = ["folder/sub/c.md", "folder/b.md", "single.md", "folder/a.md", "folderX/z.md"];
		expect(pathsInFolder(md, "folder")).toEqual(["folder/a.md", "folder/b.md", "folder/sub/c.md"]);
		expect(foldersOf(md)).toEqual(["folder", "folder/sub", "folderX"]);
	});
	it("AC-14 の core 側: FOLDER/ は folder/ に当たる。NFD もそろえる。空は当たらない", () => {
		expect(queryMatches("folder/sub/c.md", "FOLDER/")).toBe(true);
		expect(queryMatches("ノート.md".normalize("NFD"), "ノート")).toBe(true);
		expect(queryMatches("a.md", "")).toBe(false);
	});
	it("mtime_desc は新しい順、同じならパスの順", () => {
		const n = [{ path: "b", mtime: 1 }, { path: "a", mtime: 1 }, { path: "c", mtime: 2 }];
		expect(orderNotes(n, "mtime_desc").map((x) => x.path)).toEqual(["c", "a", "b"]);
		expect(orderNotes(n, "listed").map((x) => x.path)).toEqual(["b", "a", "c"]);
	});
});

describe("FR-16 の試験用文字列", () => {
	it.each([10000, 150000])("%i 文字ちょうどで、START と END で挟まれ、日本語と 🕒 を含む", (n) => {
		const t = measureText(n);
		expect(codePoints(t)).toBe(n);
		expect(t.startsWith(`NS-TEST ${n} START`)).toBe(true);
		expect(t.endsWith(`NS-TEST ${n} END`)).toBe(true);
		expect(t.includes("🕒") && t.includes("日本語")).toBe(true);
	});
});
