// 候補のノートを選ぶ(FR-1〜FR-4 の入口側): 今のノート・リンク先(深さ1)・フォルダの一覧と配下・除外の判定。
// リンク先は Obsidian の解決(getFirstLinkpathDest)を正とし、links だけを見る(埋め込み・frontmatter は入れない。D-17)。
import { getLinkpath, normalizePath, SuggestModal, type App, type TFile } from "obsidian";
import { excludedBy } from "./core/exclude";
import { foldersOf, pathsInFolder, queryMatches } from "./core/paths";
import { ALWAYS_EXCLUDE, type Settings } from "./settings";

export const NOT_MARKDOWN = "Markdown のノートを開いてから実行してください";

export interface SkippedLink {
	link: string;
	reason: "解決できない" | "md 以外";
}

export function activeMarkdown(app: App): TFile | null {
	const f = app.workspace.getActiveFile();
	return f !== null && f.extension === "md" ? f : null;
}

/** 当たった除外の規則(FR-11・INV-5)。neverPack は normalizePath を通す(§9.2) */
export function excludeRule(settings: Settings, path: string): string | null {
	return excludedBy(path, ALWAYS_EXCLUDE, settings.neverPack.map((g) => normalizePath(g)));
}

/** FR-2: 今のノートと、links の各リンクの解決先(本文での出現順。同じ物は最初の1回だけ) */
export function withLinks(app: App, file: TFile): { files: TFile[]; skipped: SkippedLink[] } {
	const links = [...(app.metadataCache.getFileCache(file)?.links ?? [])]
		.sort((a, b) => a.position.start.offset - b.position.start.offset);
	const files: TFile[] = [file];
	const seen = new Set([file.path]);
	const skipped: SkippedLink[] = [];
	const add = (s: SkippedLink) => {
		if (!skipped.some((x) => x.link === s.link && x.reason === s.reason)) skipped.push(s);
	};
	for (const l of links) {
		const dest = app.metadataCache.getFirstLinkpathDest(getLinkpath(l.link), file.path);
		if (dest === null) add({ link: l.link, reason: "解決できない" });
		else if (dest.extension !== "md") add({ link: l.link, reason: "md 以外" });
		else if (!seen.has(dest.path)) {
			seen.add(dest.path);
			files.push(dest);
		}
	}
	return { files, skipped };
}

/** FR-3: フォルダの配下の md をパスのコードポイント順で */
export function filesInFolder(app: App, folder: string): TFile[] {
	const byPath = new Map(app.vault.getMarkdownFiles().map((f) => [f.path, f]));
	return pathsInFolder([...byPath.keys()], folder).flatMap((p) => {
		const f = byPath.get(p);
		return f ? [f] : [];
	});
}

/** FR-3: フォルダを選ぶ窓。入力欄が絞り込み欄(部分一致) */
export class FolderPicker extends SuggestModal<string> {
	private readonly folders: string[];

	constructor(app: App, private readonly onPick: (folder: string) => void) {
		super(app);
		this.folders = foldersOf(app.vault.getMarkdownFiles().map((f) => f.path));
		this.limit = Math.max(this.folders.length, 1);
		this.emptyStateText = "当たるフォルダがありません";
		this.setPlaceholder("フォルダを絞り込む");
	}

	getSuggestions(query: string): string[] {
		return query === "" ? this.folders : this.folders.filter((f) => queryMatches(f, query));
	}

	renderSuggestion(folder: string, el: HTMLElement): void {
		el.setText(folder);
	}

	onChooseSuggestion(folder: string): void {
		this.onPick(folder);
	}
}
