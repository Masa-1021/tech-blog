# tech-blog プロジェクトガイド

## 概要

三田工場 生産技術グループの製造DXアプリ一覧 + 技術ブログサイト。
Next.js（静的エクスポート）→ S3 → CloudFront で配信。

## デプロイ

```bash
npm run deploy
```

ビルド → S3アップロード → CloudFrontキャッシュ削除を自動実行。

> **注意:** デプロイはローカル（社内PC）からのみ可能。GitHub ActionsはSCPにより社外IPからのS3アクセスが禁止されている。

### AWS環境

| 項目 | 値 |
|------|-----|
| サイトURL | https://dwkpbncqk2toe.cloudfront.net |
| S3バケット | blogstack-sitebucket-east1-338658063532 (us-east-1) |
| CloudFront ID | E1KKE3I5GVIO45 |
| リージョン | us-east-1（SCPによりus-west-2は使用不可） |

## 開発フロー

### ブログ記事を追加する

1. `content/posts/` に Markdownファイルを作成
2. `npm run deploy` を実行

### アプリ情報を更新する

1. `content/apps/<slug>.md` を編集
2. `npm run deploy` を実行

## コンテンツ仕様

### ブログ記事 (`content/posts/*.md`)

```yaml
---
title: "記事タイトル"
emoji: "🚀"
type: "tech"
topics: ["AWS", "Lambda"]
published: true
category: "HowTo"
date: "2026-03-24"
description: "記事の説明"
coverImage: "/images/posts/laptop-code.jpg"
---
```

**注意:** 本文に `# タイトル`（H1）を書かない（ページが自動表示するため二重になる）

### アプリ (`content/apps/*.md`)

```yaml
---
title: "APPNAME"
subtitle: "サブタイトル"
description: "説明文"
category: "収集"           # 収集 | 見える化 | 活用 | 共有・管理
level: 2                   # 1〜5（ビジョンマップのLV: 見える/つなげる/分析する/AIを活用する/AIが自走する）、対象外はnull
status: "active"           # active | coming-soon
appUrl: "https://..."      # coming-soonの場合はnull
sourceUrl: "https://..."   # ソースコードURL（任意）、なければ省略またはnull
network: "external"        # external | internal（社内サーバー）
icon: "/apps/<slug>/icon.svg"
banner: "/apps/<slug>/banner.svg"
date: "2026-03-24"
---
```

## Git リモート

| リモート | URL | 用途 |
|---------|-----|------|
| `internal` | https://d51kcriwd0i85.cloudfront.net/All_Users/tech-blog.git | 社内Gitサーバー |
| `origin` | https://github.com/Masa-1021/tech-blog | GitHub（GitHub Actions用） |

社内サーバーへのpushは `git push internal main`、GitHubへは `git push origin main`。
