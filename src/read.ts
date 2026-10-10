// ノートを読む(パックに入れるノートを Obsidian API で読むのはここだけ)。表示用のキャッシュ読みは使わない(D-20)。
// UTF-8 として不正なバイト列を見つけるため readBinary + TextDecoder(fatal) で読む(Q-12)。BOM は残し、core で削る。
// 読めなければ例外を投げず、エラー名を返す(FR-14。他のノートは続ける)。
import type { TFile, Vault } from "obsidian";
import type { SourceNote } from "./core/types";

export const NOT_UTF8 = "UTF-8 として不正なバイト列";

export type ReadResult = { ok: true; note: SourceNote } | { ok: false; path: string; error: string };

export async function readNote(vault: Vault, file: TFile): Promise<ReadResult> {
	let buf: ArrayBuffer;
	try {
		buf = await vault.readBinary(file);
	} catch (e) {
		return { ok: false, path: file.path, error: errorName(e) };
	}
	try {
		const text = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }).decode(buf);
		return { ok: true, note: { path: file.path, mtime: file.stat.mtime, text } };
	} catch {
		return { ok: false, path: file.path, error: NOT_UTF8 };
	}
}

export function errorName(e: unknown): string {
	return e instanceof Error ? e.name : String(e);
}
