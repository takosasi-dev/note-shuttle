// §8.5 の検体(AC-2): tests/golden/<検体名>/ の input・order.txt・expected.txt を、固定の時刻で組み立てた結果とバイト単位で比べる。
// order.txt は1行に「vault 相対パス<TAB>updated(YYYY-MM-DD HH:MM)」。settings.json があれば既定の上に重ねる。
// 検体の中の {{FAKE:名前}} は、読んだ後に fakes.ts の偽の鍵に置き換える(鍵の形の文字列をファイルに置かないため)。
import { Buffer } from "node:buffer";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { buildPack } from "../src/core/emit";
import type { SourceNote } from "../src/core/types";
import { normalizeSettings } from "../src/settings";
import { fillFakes } from "./fakes";

const HERE = fileURLToPath(new URL(".", import.meta.url));
const GOLDEN = join(HERE, "golden");
/** 生成の時刻(端末の時刻で 2026-10-10 12:30) */
const NOW = new Date(2026, 9, 10, 12, 30).getTime();

function localMs(s: string): number {
	const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(s);
	if (!m) throw new Error(`日時の形が違う: ${s}`);
	return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), Number(m[4]), Number(m[5])).getTime();
}

/** read.ts と同じ読み方(fatal・BOM を残す) */
function decode(buf: Buffer): string {
	return new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
}

const names = readdirSync(GOLDEN).sort();

describe("§8.5 の検体(AC-2)", () => {
	it("4つの検体がそろっている", () => {
		expect(names).toEqual(["count", "mask", "order", "syntax"]);
	});

	for (const name of names) {
		it(`${name}: expected.txt とバイト単位で一致する`, () => {
			const dir = join(GOLDEN, name);
			const sources: SourceNote[] = readFileSync(join(dir, "order.txt"), "utf8").split("\n").filter((l) => l !== "").map((l) => {
				const [path = "", updated = ""] = l.split("\t");
				return { path, mtime: localMs(updated), text: fillFakes(decode(readFileSync(join(dir, "input", ...path.split("/"))))) };
			});
			const extra: unknown = existsSync(join(dir, "settings.json")) ? JSON.parse(readFileSync(join(dir, "settings.json"), "utf8")) : {};
			const { settings } = normalizeSettings(extra);
			const r = buildPack(sources, settings, NOW);
			expect(r.kind).toBe("ok");
			if (r.kind !== "ok") return;
			expect(Buffer.from(r.text, "utf8").equals(readFileSync(join(dir, "expected.txt")))).toBe(true);
			expect(r.text).toBe(readFileSync(join(dir, "expected.txt"), "utf8"));   // 違ったときに差分を見せる
		});
	}

	it("開発用 vault の検体(4)は golden と同じバイト列(AC-10 の前提)", () => {
		for (const n of ["a", "b", "c"]) {
			const g = readFileSync(join(GOLDEN, "order", "input", "order", `${n}.md`));
			const f = readFileSync(join(HERE, "fixtures", "vault", "order", `${n}.md`));
			expect(f.equals(g)).toBe(true);
		}
	});
});
