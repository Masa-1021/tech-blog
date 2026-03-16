# tech-blog

個人技術ブログ。Next.js 静的サイト + AWS (S3 / CloudFront) で運用。

- **サイトURL**: https://dwkpbncqk2toe.cloudfront.net
- **GitHubリポジトリ**: https://github.com/Masa-1021/tech-blog

---

## 記事の投稿方法

### 手順

1. `content/posts/` にMarkdownファイルを追加する
2. `main` ブランチにプッシュする（またはGitHub上でファイルを追加する）
3. GitHub Actions が自動でビルド＆デプロイ（約1〜2分）

```
content/posts/
  └── YYYY-MM-DD-記事スラッグ.md   ← ここにファイルを置くだけ
```

> GitHub上から直接追加する場合:
> https://github.com/Masa-1021/tech-blog/tree/main/content/posts
> → 「Add file」→「Create new file」または「Upload files」

---

## Markdownファイルの書き方

### ファイル名

```
YYYY-MM-DD-slug.md
```

- `YYYY-MM-DD`: 公開日（例: `2026-03-16`）
- `slug`: URL になる文字列。英数字とハイフンのみ使用（例: `aws-lambda-streaming`）

**例:** `2026-03-16-aws-lambda-streaming.md`

---

### フロントマター（必須）

ファイルの先頭に以下の形式で記述する。

```yaml
---
title: "記事のタイトル"
emoji: "🚀"
type: "tech"
topics: ["AWS", "Lambda", "Python"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "検索結果やOGPに使われる説明文（100〜160文字目安）"
coverImage: "/images/posts/laptop-code.jpg"
---
```

#### 各フィールドの説明

| フィールド | 必須 | 説明 |
|-----------|------|------|
| `title` | ✅ | 記事タイトル |
| `emoji` | ✅ | 記事アイコン（絵文字1文字） |
| `type` | ✅ | 常に `"tech"` |
| `topics` | ✅ | タグ（最大5つ推奨） |
| `published` | ✅ | `true` で公開、`false` で下書き |
| `category` | ✅ | 下記カテゴリ一覧から選択 |
| `date` | ✅ | 公開日 `YYYY-MM-DD` 形式 |
| `description` | ✅ | 記事の概要（OGP・検索に使用） |
| `coverImage` | ✅ | カバー画像パス（下記一覧から選択） |
| `series` | — | シリーズ名（連載の場合） |
| `seriesOrder` | — | シリーズ内の順番（1, 2, 3...） |

#### カテゴリ一覧

```
HowTo        実装手順・チュートリアル
Architecture 設計・アーキテクチャ解説
Tips         Tips・ノウハウ
Troubleshoot トラブルシューティング
```

#### 使用できるカバー画像

```
/images/posts/laptop-code.jpg
/images/posts/coding-screen.jpg
/images/posts/code-editor.jpg
/images/posts/workspace.jpg
```

> 専用カバー画像を用意する場合は `public/images/posts/` に画像を追加してパスを指定する。

---

### 本文の書き方

フロントマターの直後から本文を書く（`# タイトル` は不要）。

```markdown
---
title: "記事タイトル"
...
---

## はじめに

本文をここから書く。

## コードの書き方

\`\`\`python
print("Hello, World!")
\`\`\`
```

> **注意:** `# タイトル`（H1見出し）はページが自動で表示するため、本文には書かない。書くと二重表示になる。

---

### シリーズ記事の書き方

連載記事の場合は `series` と `seriesOrder` を追加し、本文先頭にシリーズナビゲーションのblockquoteを入れる。

```markdown
---
title: "第1回: ..."
series: "シリーズタイトル"
seriesOrder: 1
...
---

> **このシリーズ: 全3回**
> 1. [第1回: タイトル](/posts/2026-03-16-slug-01) ← 今ここ
> 2. [第2回: タイトル](/posts/2026-03-16-slug-02)
> 3. [第3回: タイトル](/posts/2026-03-16-slug-03)

## はじめに
...
```

---

### テンプレート

```markdown
---
title: "記事タイトル"
emoji: "🚀"
type: "tech"
topics: ["AWS", "Python"]
published: true
category: "HowTo"
date: "2026-03-16"
description: "記事の概要を100〜160文字で記述する。"
coverImage: "/images/posts/laptop-code.jpg"
---

## はじめに

ここから本文を書く。

## セクション1

内容...

## まとめ

まとめ...
```

---

## インフラ構成

| リソース | 詳細 |
|---------|------|
| フロントエンド | Next.js 15 (静的エクスポート) |
| ホスティング | AWS S3 + CloudFront |
| 認証・制限 | AWS WAF（IPアドレス制限） |
| CI/CD | GitHub Actions（main push で自動デプロイ） |
| リージョン | us-west-2（S3 / CloudFront）、us-east-1（WAF） |
