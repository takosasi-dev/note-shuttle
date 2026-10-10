// 数え方: コードポイント数(Python の len() と同じ。D-14)・数の書き方・推定トークン・予算の判定(FR-8)。
// String.length(UTF-16 の単位)と toLocaleString は使わない(§9.5.4)。

/** コードポイント数。🕒 は 1(String.length なら 2) */
export function codePoints(s: string): number {
	let n = s.length;
	for (let i = 0; i < s.length - 1; i++) {
		const c = s.charCodeAt(i);
		if (c >= 0xd800 && c <= 0xdbff) {
			const d = s.charCodeAt(i + 1);
			if (d >= 0xdc00 && d <= 0xdfff) {
				n--;
				i++;
			}
		}
	}
	return n;
}

/** 半角数字・3桁ごとに半角カンマ(84,213) */
export function formatNumber(n: number): string {
	const sign = n < 0 ? "-" : "";
	const digits = String(Math.abs(Math.trunc(n)));
	let out = "";
	for (let i = 0; i < digits.length; i++) {
		if (i > 0 && (digits.length - i) % 3 === 0) out += ",";
		out += digits[i];
	}
	return sign + out;
}

/** 推定トークン = 文字数 × 係数 を 1,000 単位に四捨五入(Q-10(b)。84,213 → 84,000) */
export function estimateTokens(chars: number, tokenPerChar: number): number {
	return Math.floor((chars * tokenPerChar) / 1000 + 0.5) * 1000;
}

export interface BudgetJudge {
	total: number;
	/** 予算を超えた文字数(超えていなければ 0) */
	over: number;
	ok: boolean;
	/** 文字数の大きい順(同じなら元の順) */
	breakdown: { path: string; chars: number }[];
}

/** 予算の判定。合計が予算ちょうどならコピーできる(FR-8・§10) */
export function judgeBudget(notes: readonly { path: string; chars: number }[], budgetChars: number): BudgetJudge {
	const total = notes.reduce((a, n) => a + n.chars, 0);
	const breakdown = notes.map((n) => ({ path: n.path, chars: n.chars })).sort((a, b) => b.chars - a.chars);
	return { total, over: Math.max(0, total - budgetChars), ok: total <= budgetChars, breakdown };
}
