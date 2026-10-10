// 設定画面(getSettingDefinitions。1.13.0 以降。VaultDoctor プラグイン版 D-9 と同じ書き方)。保存は saveData() だけ。
// 伏せ字の6種は1種1行で、正規表現として不正・空ならその行に「無効」と出す(FR-13)。不正でも保存し、コマンドが止める(INV-6・AC-19)。
// 規則の追加・削除・伏せ字を切る設定は持たない(D-13)。固定の除外は見せるだけ(INV-5)。
import { PluginSettingTab, type App, type Setting, type SettingDefinitionItem } from "obsidian";
import { MASK_KINDS } from "./core/mask";
import type NoteShuttlePlugin from "./main";
import { ALWAYS_EXCLUDE } from "./settings";

const LIST_KEYS = new Set(["neverPack", "maskLiterals"]);

function ruleValid(pattern: string): boolean {
	if (pattern.trim() === "") return false;
	try {
		new RegExp(pattern, "g");
		return true;
	} catch {
		return false;
	}
}

export class NoteShuttleSettingTab extends PluginSettingTab {
	constructor(app: App, private readonly owner: NoteShuttlePlugin) {
		super(app, owner);
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		return [
			{ type: "group", items: [
				{ name: "予算(文字)", desc: "パックの合計文字数(コードポイント数)の上限。超えたらコピーしない",
					control: { type: "number", key: "budgetChars", min: 1, step: 1,
						validate: (v: number) => (Number.isInteger(v) && v > 0 ? undefined : "1 以上の整数を入れてください") } },
				{ name: "推定トークンの係数", desc: "推定トークン = 文字数 × 係数(表示だけの概算)",
					control: { type: "number", key: "tokenPerChar", min: 0, step: "any",
						validate: (v: number) => (Number.isFinite(v) && v >= 0 ? undefined : "0 以上の数を入れてください") } },
				{ name: "frontmatter を残す", control: { type: "toggle", key: "keepFrontmatter" } },
				{ name: "並び順", control: { type: "dropdown", key: "order", options: { listed: "一覧の順", mtime_desc: "更新が新しい順" } } },
			] },
			{ type: "group", heading: "除外", items: [
				{ name: "固定の除外", desc: `${ALWAYS_EXCLUDE.join("  ")}(変えられません)` },
				{ name: "パックに入れないノート", desc: "1行に1つの glob。vault 直下からのパス全体に当てる。* は / 以外、** は / を含む、? は / 以外の1文字。大文字小文字を区別しない(例 secret/**)",
					control: { type: "textarea", key: "neverPack", rows: 4 } },
			] },
			{ type: "group", heading: "伏せ字", items: [
				...MASK_KINDS.map((kind) => ({ name: kind, render: (setting: Setting) => this.renderRule(setting, kind) })),
				{ name: "固定の文字列", desc: "1行に1つ。大文字小文字を区別して完全一致で [MASKED:literal] に置き換える",
					control: { type: "textarea", key: "maskLiterals", rows: 3 } },
			] },
		];
	}

	private renderRule(setting: Setting, kind: string): void {
		const current = () => this.owner.settings.maskRules.find((r) => r.kind === kind)?.pattern ?? "";
		const mark = (p: string) => setting.setDesc(ruleValid(p) ? "" : "無効");
		setting.setName(kind);
		mark(current());
		setting.addText((t) => t.setValue(current()).onChange(async (v) => {
			const s = this.owner.settings;
			const others = s.maskRules.filter((r) => r.kind !== kind);
			// §9.5.3 の順を保つ
			s.maskRules = MASK_KINDS.flatMap((k) => (k === kind ? [{ kind, pattern: v }] : others.filter((r) => r.kind === k)));
			mark(v);
			await this.owner.saveSettings();
		}));
	}

	/** 配列は1行に1つの文字にして見せる */
	getControlValue(key: string): unknown {
		const s = this.owner.settings as unknown as Record<string, unknown>;
		return LIST_KEYS.has(key) ? (s[key] as string[]).join("\n") : s[key];
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		const s = this.owner.settings as unknown as Record<string, unknown>;
		s[key] = LIST_KEYS.has(key) ? String(value).split(/\r?\n/).map((x) => x.trim()).filter((x) => x !== "") : value;
		await this.owner.saveSettings();
	}
}
