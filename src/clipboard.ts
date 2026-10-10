// クリップボードへの書き込みと、その後の通知(FR-12)。writeText は呼んだその場で始める(D-19)。
// 呼び手はボタンの処理の最初にこれを呼び、前に await を挟まない。自動で繰り返さない(§10)。
import { Notice } from "obsidian";
import { formatNumber } from "./core/count";
import { errorName } from "./read";

export interface CopiedSummary {
	notes: number;
	chars: number;
	masked: number;
}

/** その場で書き始める。navigator.clipboard が無いときの同期の例外も失敗の Promise にする */
export function writeNow(text: string): Promise<void> {
	try {
		return navigator.clipboard.writeText(text);
	} catch (e) {
		return Promise.reject(e instanceof Error ? e : new Error(String(e)));
	}
}

/** 成功なら true。通知はここで出す */
export function copyPack(text: string, s: CopiedSummary): Promise<boolean> {
	return writeNow(text).then(
		() => {
			new Notice(`${formatNumber(s.notes)}本・${formatNumber(s.chars)}文字・伏せ字${formatNumber(s.masked)}件をコピーしました`);
			return true;
		},
		(e: unknown) => {
			new Notice(`コピーできませんでした: ${errorName(e)}`);
			return false;
		},
	);
}
