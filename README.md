# Note Shuttle

選んだノートを 1 つの文(パック)にまとめ、API の鍵やトークンの形を伏せ字にして、クリップボードに写す Obsidian プラグインです。AI のチャットに貼るための道具です。ノートは読むだけで、書き換えません。ネットワークには出ず、LLM も呼びません(要約や言い換えをしません)。PC でもモバイルでも動く作りですが、モバイルの実機ではまだ確かめていません。

*English summary is at the bottom.*

## できること

- **今のノートをコピー**: 開いているノート 1 本を、窓を出さずにパックにしてコピーする
- **リンク先も一緒に**: 今のノートと、本文のリンク先(1 段だけ)をまとめる
- **フォルダごと**: 選んだフォルダの下(サブフォルダも)のノートをまとめる
- **選んで足す**: パスで探して、1 本ずつ足す
- **伏せ字**: 6 種の鍵・トークンの形と、自分で決めた文字列を `[MASKED:種類]` に置き換える
- **予算**: 合計の文字数に上限(既定 150,000 文字)があり、超えたらコピーしない
- **入れないノート**: glob で決めたノートやフォルダを、いつもパックから外す
- **整形**: frontmatter・画像・埋め込み・Dataview のブロック・コメントを、貼る用の短い形にする

## 向いている vault(前提)

ノートの形に決まりはありません。Markdown のノート(`.md`)ならどれでも使えます。Obsidian 1.14.4 以降が要ります。

使う前に、次の 2 つの設定を自分の vault に合わせて入れてください。どちらも既定は空です。

- 「パックに入れないノート」: チャットに出したくないノートやフォルダ(例 `secret/**`)
- 「固定の文字列」: 住所のように、決まった文字列で伏せたい物

「固定の除外」(下の「設定」の表)は作者の環境に合わせたフォルダの一覧で、変えられません。

## 入れ方

### BRAT で入れる(おすすめ)
1. コミュニティプラグインの「BRAT」(Obsidian42 - BRAT)を入れて有効にする。
2. BRAT の設定 → 「Add Beta plugin」に `takosasi-dev/note-shuttle` を入れる。
3. コミュニティプラグインの一覧で「Note Shuttle」を有効にする。

### 手で入れる
[Releases](https://github.com/takosasi-dev/note-shuttle/releases) から `main.js`・`manifest.json`・`styles.css` を落とし、vault の `.obsidian/plugins/note-shuttle/` に置いて、コミュニティプラグインの一覧で有効にします。

## 使い方

### コマンド

| コマンドパレットに出る名前 | すること |
|---|---|
| 今のノートをパックしてコピー | 開いているノート 1 本を、窓を出さずにコピーする。予算を超えた・除外に当たった・読めなかった・書けなかったときは、代わりに「パックの中身」の窓が開く |
| 今のノートとリンク先をパック | 開いているノートと、本文のリンク先を、出てきた順に 1 回ずつ「パックの中身」の窓に並べる |
| フォルダを選んでパック | フォルダを選ぶと、その下のノートをパスの順に窓に並べる |
| ノートを選んでパック | 空の窓を開く。絞り込み欄に 1 文字以上入れると候補が出て、押すと一覧の末尾に入る |
| クリップボード実測(開発用) | 開発用の確認の窓。試験用の文字列をクリップボードに書くだけで、ふだんは使わない |

既定のホットキーはありません。Markdown のノートを開いていないと、今のノートを使う 2 つは「Markdown のノートを開いてから実行してください」と出て何もしません。

### 画面の見方(「パックの中身」の窓)

- 上: 「合計 6,210 / 150,000 文字」「推定トークン 約6,000(概算)」「伏せ字 3件(github 1, discord 2)」
- 絞り込み欄(「パスで探して追加(1文字以上)」)と候補
- 一覧: チェック・パス・更新日時・文字数。チェックを外すと、その場で合計が変わる
- 下(あるときだけ): 「除外したノート」(パスと当たった規則)・「読めなかったノート」・「加えなかったリンク」(「解決できない」か「md 以外」)
- 「コピー」を押すとクリップボードに入り、「2本・6,210文字・伏せ字3件をコピーしました」と出て窓が閉じる
- 「コピー」が押せないとき: 「対象0本」/「予算を N 文字超えています。チェックを外してください」(大きい順の内訳が出る)/「パスに伏せ字の対象があります: <パス>」/「パックに伏せ字の対象が残っています」

### パックの形

先頭の説明 → 表 → `<note>` の並び、の順です。

```
<!-- NoteShuttle pack v1 -->
# 文脈パック: adhoc

生成: 2026-01-15 12:30 / ノート 1本 / 4,100文字 / 推定トークン 約4,000(概算) / 伏せ字 1件(github 1)

このファイルは Obsidian vault のノートを束ねたもの。各 <note> の path は vault 直下からの相対パス、updated は最終更新日時。埋め込み・画像は [埋め込み: 名前] に置き換えてある。

| # | path | updated | 文字数 |
|---|---|---|---|
| 1 | メモ/A.md | 2026-01-14 23:10 | 4,100 |

<note path="メモ/A.md" updated="2026-01-14 23:10">
(整形して伏せ字にした本文)
</note>
```

ノートが 2 本以上なら、表の行と `<note>` のかたまりが、その数だけ並びます。

本文の整形: frontmatter は削る(設定で残せる)。画像(`png`・`jpg`・`jpeg`・`gif`・`webp`・`svg`)は `[画像: 名前]`、そのほかの埋め込みは `[埋め込み: 名前]` に置き換え、中身は入らない。`dataview`・`dataviewjs`・`base` のブロックは `[Dataviewクエリ省略]` にする。`%% %%` のコメントは削る。3 行以上続く空行は 2 行にする。wiki リンクはそのまま。

### 伏せ字になる物

当たった所は `[MASKED:github]` のように、種類の名前つきで置き換わります。コードブロックの中にもかかります。大文字小文字は区別します。

| 設定に出る名前 | 伏せる形(既定) |
|---|---|
| `anthropic` | `sk-ant-` に、英数字・`_`・`-` が 20 文字以上続く物 |
| `openai` | `sk-` か `sk-proj-` に、英数字・`_`・`-` が 20 文字以上続く物 |
| `github` | `ghp_`・`gho_`・`ghs_`・`ghu_` に英数字 36 文字、または `github_pat_` に英数字・`_` が 50 文字以上 |
| `aws_key` | `AKIA` に、数字・英大文字 16 文字 |
| `discord` | `M`・`N`・`O` のどれかで始まり、点で 3 つ(24〜28 文字・6 文字・27〜40 文字)に区切られた文字列 |
| `private_key` | `-----BEGIN … PRIVATE KEY-----` から `-----END … PRIVATE KEY-----` まで |
| 固定の文字列 | 設定に入れた文字列そのもの。`[MASKED:literal]` になる |

既定の正規表現(設定で書き換えられます):

```
anthropic    sk-ant-[A-Za-z0-9_\-]{20,}
openai       sk-(?:proj-)?[A-Za-z0-9_\-]{20,}
github       (?:ghp|gho|ghs|ghu)_[A-Za-z0-9]{36}|github_pat_[A-Za-z0-9_]{50,}
aws_key      AKIA[0-9A-Z]{16}
discord      [MNO][A-Za-z0-9_\-]{23,27}\.[A-Za-z0-9_\-]{6}\.[A-Za-z0-9_\-]{27,40}
private_key  -----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]+?-----END [A-Z ]*PRIVATE KEY-----
```

## 設定

| 項目 | 既定 | 内容 |
|---|---|---|
| 予算(文字) | 150000 | パックの合計文字数の上限。超えたらコピーしない。1 以上の整数 |
| 推定トークンの係数 | 1 | 推定トークン = 文字数 × 係数(表示だけの概算。1,000 単位に丸める) |
| frontmatter を残す | OFF | ON にすると frontmatter を削らない |
| 並び順 | 一覧の順 | 「一覧の順」か「更新が新しい順」 |
| 固定の除外 | (変えられない) | `.obsidian/` `.git/` `.trash/` `copilot/skills/` `.claude/` `.agents/` `.opencode/` の下は、いつもパックに入らない |
| パックに入れないノート | 空 | 1 行に 1 つの glob。vault 直下からのパス全体に当てる。`*` は `/` 以外、`**` は `/` を含む、`?` は `/` 以外の 1 文字。大文字小文字を区別しない(例 `secret/**`) |
| `anthropic` 〜 `private_key` の 6 行 | 上の正規表現 | 1 種 1 行。空や不正にするとその行に「無効」と出る |
| 固定の文字列 | 空 | 1 行に 1 つ。大文字小文字を区別して、完全一致で `[MASKED:literal]` に置き換える |

## 安全のための決まり

- vault のノートは 1 つも書き換えない(作る・消す・動かす・名前を変える、もしない)。書くのは自分の設定(`data.json`)とクリップボードだけ
- ネットワークに出ない。LLM を呼ばない。Node.js / Electron の機能を使わない(モバイルでも動く作り)
- クリップボードに書くのは、「今のノートをパックしてコピー」を実行したとき、「パックの中身」の窓で「コピー」を押したとき、開発用の実測の窓でボタンを押したとき(試験用の文字列だけ)
- 組み上がったパックの全文に、もう一度すべての伏せ字の規則を当て、1 件でも当たればコピーしない
- 6 種の規則のどれかが空・不正だと、パックのコマンドは「伏せ字の規則が不正です: <種類>」と出して止まる。伏せ字を切る設定は無い
- UTF-8 として読めないノートは「読めなかったノート」に出て、ほかのノートは続く
- `data.json` が読めない・形が違うときは既定値で動き、`data.json` は書き換えない(知らせが出る)

## 動作確認の状況

- 版 0.1.0。Windows の Obsidian 1.14.4 で動作を確認(今のノートのパック、リンク先を入れた窓、フォルダ選び、設定画面)
- パックの形・整形・伏せ字・予算の判定は、作り物のノートと偽の鍵を使ったテストで確認
- **本物のクリップボードに入る所は未確認**(確認用に差し替えた環境で、書かれる中身だけを見た)
- iPhone・Android の実機は未確認(モバイル表示のエミュレーションで読み込みと表示まで確認)。モバイルでコピーできるか、10 万文字を超えるパックがチャットのアプリに末尾まで貼れるかは、まだ見ていない

## 分かっている限界

- **伏せ字は完全ではない。** 形で見つけるだけなので、6 種と「固定の文字列」に当たらない秘密(パスワード、ほかのサービスの鍵、形の違うトークン、個人の情報)は、そのまま出る。既定の 6 種の形も、偽の値で確かめただけ。窓にはパックの本文が出ないので、貼ったら送る前に自分で目を通す
- ファイル名やフォルダ名に伏せ字の対象が入っていると、コピーしない。そのノートのチェックを外すか、名前を変える
- 「固定の文字列」がトークンの頭に重なると、先に当たった方だけを伏せ、トークンの残りが出ることがある。「固定の文字列」に `MASKED` や `文脈パック` のような、パックの決まった文字を入れると、必ずコピーが止まる
- 文字数に入るのは、整形して伏せ字にした後の本文だけ。パックの先頭の説明と表は入らない。予算を超えても自動では削らない
- リンク先は 1 段だけ。埋め込み(`![[…]]`)と frontmatter のリンクは足さない
- 窓を開いた後でノートを直しても、中身は開いたときのまま。作り直すには開き直す
- 開発用のコマンド「クリップボード実測(開発用)」が残っている

## 開発

```
npm install
npm run build        # main.js を作る(型チェックつき)
npm test             # vitest
npm run lint         # eslint-plugin-obsidianmd
```

整形・伏せ字・数え方・組み立ての中身は obsidian を import しない関数で、テストは作り物のノートと偽の鍵だけを使います。`tests/golden/` と `tests/fixtures/` はバイト列のまま持つ検体です(CRLF・BOM・UTF-8 でないバイトを含む)。

## ライセンス

MIT。[LICENSE](LICENSE) を見てください。

---

## English summary

**Note Shuttle** bundles the notes you pick into one text, masks secret-shaped strings, and copies the result to the clipboard for pasting into an AI chat.

- Read-only for your vault: it never creates, changes, moves, or deletes notes. It writes only its own settings (`data.json`) and the clipboard.
- No network access and no LLM calls. No Node.js or Electron APIs.
- Pick the current note, the current note plus its linked notes (one level), a folder, or notes found by path.
- Masks six token shapes (Anthropic, OpenAI, GitHub, AWS access key ID, Discord, PEM private keys) plus your own fixed strings, as `[MASKED:kind]`. The patterns are editable. **Masking is by shape only and is not complete; read the text before you send it.**
- Refuses to copy when the total exceeds the budget (default 150,000 characters), and when a mask pattern still matches the finished text.
- Works with any Markdown notes. Exclude notes with glob patterns (empty by default).
- Install with BRAT: `takosasi-dev/note-shuttle`. Requires Obsidian 1.14.4 or later. The UI is Japanese only.
- Tested on Windows desktop (Obsidian 1.14.4) only. Writing to the real system clipboard and real phones have not been tested yet.
