// 整形(§9.5.2 = CLI 版 §9.5 の表の8行を、書かれた順に)。前後に Q-10(e) の CRLF・BOM と Q-10(d) の末尾の改行。
// 画像・埋め込みの名前は、リンク先の書かれたとおり(wiki は `|` より前、markdown は括弧の中のパス)。

const IMAGE_EXT = /\.(?:png|jpg|jpeg|gif|webp|svg)$/i;

/** `![alt](target)` の括弧の中から、パスの部分(<...> か最初の空白まで)を取る */
function markdownTarget(inner: string): string {
	const t = inner.trim();
	if (t.startsWith("<")) {
		const end = t.indexOf(">");
		return end > 0 ? t.slice(1, end) : t;
	}
	const sp = t.search(/\s/);
	return sp < 0 ? t : t.slice(0, sp);
}

function isImage(target: string): boolean {
	return IMAGE_EXT.test(target.replace(/[?#].*$/, ""));
}

/** 1行ずつ見て、3行以上続く空行を2行にする */
function collapseBlankLines(text: string): string {
	const out: string[] = [];
	let run = 0;
	for (const line of text.split("\n")) {
		run = line === "" ? run + 1 : 0;
		if (run <= 2) out.push(line);
	}
	return out.join("\n");
}

export function formatNote(text: string, keepFrontmatter: boolean): string {
	// Q-10(e): 先頭の BOM を削り、CRLF を LF にそろえる
	let s = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
	// 1. frontmatter(先頭の --- 〜 ---)
	if (!keepFrontmatter) s = s.replace(/^---\n(?:[\s\S]*?\n)?---(?:\n|$)/, "");
	// 2. 画像の ![[x.png]] と ![alt](path)
	s = s.replace(/!\[\[([^\]\n]+?)\]\]/g, (m: string, inner: string) => {
		const name = (inner.split("|")[0] ?? "").trim();
		return isImage(name) ? `[画像: ${name}]` : m;
	});
	s = s.replace(/!\[[^\]\n]*\]\(([^)\n]+)\)/g, (m: string, inner: string) => {
		const target = markdownTarget(inner);
		return isImage(target) ? `[画像: ${target}]` : m;
	});
	// 3. ノート埋め込み ![[ノート名]]
	s = s.replace(/!\[\[([^\]\n]+?)\]\]/g, (_m: string, inner: string) => `[埋め込み: ${(inner.split("|")[0] ?? "").trim()}]`);
	// 4. dataview / dataviewjs / base のコードブロック → 1行
	s = s.replace(/^```(?:dataview|dataviewjs|base)[ \t]*\n(?:[\s\S]*?\n)?```[ \t]*$/gm, "[Dataviewクエリ省略]");
	// 5. %% コメント %%(複数行を含む)
	s = s.replace(/%%[\s\S]*?%%/g, "");
	// 6. 本文中の </note>
	s = s.split("</note>").join("<\\/note>");
	// 7. 3行以上続く空行 → 2行
	s = collapseBlankLines(s);
	// 8. wiki リンクはそのまま
	// Q-10(d): 本文末尾の改行はすべて削る
	return s.replace(/\n+$/, "");
}
