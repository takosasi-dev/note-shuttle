// src/ を文字で調べる受け入れ基準(AC-20・AC-21・AC-22・AC-24)と、後読み・manifest・コマンドの id。毎回回して戻りを防ぐ。
// AC-26 の後半(measure が 0 件)は Phase 4 で FR-16 を消すときに足す(iPhone の実測が済むまで残す)。
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT = fileURLToPath(new URL("..", import.meta.url));
const SRC = join(ROOT, "src");

function sources(dir: string): string[] {
	return readdirSync(dir).flatMap((n) => {
		const p = join(dir, n);
		return statSync(p).isDirectory() ? sources(p) : p.endsWith(".ts") ? [p] : [];
	});
}

const src = sources(SRC).map((p) => ({ p: relative(SRC, p).replace(/\\/g, "/"), text: readFileSync(p, "utf8") }));
const hits = (words: string[]) => src.flatMap(({ p, text }) => words.filter((w) => text.includes(w)).map((w) => `${p}: ${w}`));

describe("src/ の文字の検査", () => {
	it("AC-20: 書き込み系と cachedRead が 0 件(INV-1・D-20)", () => {
		expect(hits(["vault.modify", "vault.create", "vault.delete", "vault.trash", "vault.rename", "vault.process",
			"vault.append", "adapter.", "fileManager", "cachedRead"])).toEqual([]);
	});
	it("AC-21: HTML を文字で入れる書き方が 0 件(INV-8)", () => {
		expect(hits(["innerHTML", "outerHTML", "insertAdjacentHTML"])).toEqual([]);
	});
	it("AC-22: Node・Electron・通信・console.log/debug が 0 件(INV-2・INV-3・INV-7)", () => {
		const mods = ["fs", "path", "electron", "child_process"].flatMap((m) => [`from "${m}"`, `from '${m}'`, `from "node:${m}"`, `from 'node:${m}'`]);
		expect(hits(["require(", ...mods, "fetch(", "requestUrl", "XMLHttpRequest", "WebSocket", "console.log", "console.debug"])).toEqual([]);
	});
	it("AC-24: copilot/skills は settings.ts の中にしか無い(D-6)", () => {
		expect(src.filter(({ text }) => text.includes("copilot/skills")).map(({ p }) => p)).toEqual(["settings.ts"]);
	});
	it("正規表現に後読みが無い(古い iOS の対策)", () => {
		expect(src.filter(({ text }) => /\(\?<[=!]/.test(text)).map(({ p }) => p)).toEqual([]);
	});
	it("core/ は obsidian を import しない(D-5)", () => {
		expect(src.filter(({ p, text }) => p.startsWith("core/") && /from ["']obsidian["']/.test(text)).map(({ p }) => p)).toEqual([]);
	});
	it("各ファイルの先頭は責務の日本語コメント(3行以内)", () => {
		for (const { p, text } of src) {
			const head = text.split("\n").slice(0, 4);
			const n = head.findIndex((l) => !l.startsWith("//"));
			expect(n, p).toBeGreaterThanOrEqual(1);
			expect(n, p).toBeLessThanOrEqual(3);
		}
	});
});

describe("manifest とコマンド(§9.1・§9.3)", () => {
	it("isDesktopOnly は false、id は note-shuttle", () => {
		const m = JSON.parse(readFileSync(join(ROOT, "manifest.json"), "utf8")) as { id: string; isDesktopOnly: boolean };
		expect(m).toMatchObject({ id: "note-shuttle", isDesktopOnly: false });
	});
	it("コマンドの id は §9.3 のとおりで、既定のホットキーを付けない", () => {
		const main = readFileSync(join(SRC, "main.ts"), "utf8");
		const ids = [...main.matchAll(/addCommand\(\{ id: "([^"]+)"/g)].map((m) => m[1]);
		expect(ids).toEqual(["copy-current-note", "pack-current-with-links", "pack-folder", "pack-picked-notes", "measure-clipboard"]);
		expect(main.includes("hotkeys")).toBe(false);
	});
});
