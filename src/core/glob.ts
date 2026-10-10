// neverPack の glob(Q-10(g)): `*` は / 以外の0文字以上、`**` は / を含む0文字以上、`?` は / 以外の1文字。
// vault 相対パス全体に当て、大文字小文字を区別しない。両側を NFC にそろえて比べる(iPhone 由来の NFD でも漏らさない)。

function escapeChar(c: string): string {
	return /[\\^$.*+?()[\]{}|]/.test(c) ? "\\" + c : c;
}

export function globToRegExp(glob: string): RegExp {
	const g = glob.normalize("NFC");
	let src = "";
	for (let i = 0; i < g.length; i++) {
		const c = g.charAt(i);
		if (c === "*" && g.charAt(i + 1) === "*") {
			src += "[\\s\\S]*";
			i++;
		} else if (c === "*") {
			src += "[^/]*";
		} else if (c === "?") {
			src += "[^/]";
		} else {
			src += escapeChar(c);
		}
	}
	return new RegExp("^" + src + "$", "iu");
}

export function matchGlob(path: string, glob: string): boolean {
	return globToRegExp(glob).test(path.normalize("NFC"));
}
