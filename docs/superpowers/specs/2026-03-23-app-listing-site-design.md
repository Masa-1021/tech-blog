# アプリ一覧サイト設計書

**日付:** 2026-03-23
**対象リポジトリ:** `/c/Users/dw35816/Apps/tech-blog`
**CloudFront:** E1KKE3I5GVIO45 (`https://dwkpbncqk2toe.cloudfront.net/`)

---

## 1. 概要

製造DXアプリ群を一覧表示するサイトをCloudFront上に構築する。既存のtec-blog（Next.js）に機能追加する形で実装する。アプリ群が「自律型工場」という大きなビジョンに向かう過程であることを示すビジョンマップを設ける。

---

## 2. ルーティング変更

| パス | 変更前 | 変更後 |
|------|--------|--------|
| `/` | ブログ一覧 | **アプリ一覧ページ（新規）** |
| `/posts/` | （なし） | **ブログ一覧（移動）** |
| `/posts/[slug]/` | ブログ記事詳細 | ブログ記事詳細（**変更なし**） |
| `/apps/[slug]/` | （なし） | **アプリ詳細レポートページ（新規）** |

---

## 3. アプリ一覧（15カード）

### カテゴリ別

| カテゴリ | アプリ | URL | ステータス |
|----------|--------|-----|-----------|
| **収集** | CHATTRACK | https://main.d3dt9ir2fyc53u.amplifyapp.com | active |
| **収集** | XC-GATE | - | coming-soon |
| **収集** | YAGI | https://d3ridioslsorxr.cloudfront.net/ | active |
| **収集** | COLORS | https://github.com/Masa-1021/color-detector-app | active |
| **収集** | HINT（完成データアップロード） | https://mitsubishielectricgroup.sharepoint.com/... | active |
| **見える化** | QUICK | http://10.168.124.32:8001/ | active |
| **見える化** | TRACEABILITY | http://10.168.252.16:8080/ | active |
| **見える化** | SMT | - | coming-soon |
| **見える化** | AXIS | http://10.168.124.32:5175/ | active |
| **見える化** | HINT（Excel出力ツール） | https://mitsubishielectricgroup.sharepoint.com/... | active |
| **活用** | ANCIENT | https://d31xg64tu1x2pw.cloudfront.net/ | active |
| **活用** | FORESIGHT | - | coming-soon |
| **活用** | SUNRISE | http://10.168.124.3:8000/home/ | active |
| **共有・管理** | TTS | https://d32ji48tzde5hw.cloudfront.net/ | active |
| **共有・管理** | TECH-BLOG | https://dwkpbncqk2toe.cloudfront.net/ | active |

### LVマッピング（ビジョンマップ用）

| LV | テーマ | アプリ |
|----|--------|--------|
| LV.1 | 見える | QUICK, AXIS |
| LV.2 | つなげる | CHATTRACK, XC-GATE, YAGI, COLORS, HINT（アップロード） |
| LV.3 | 流れを制御する | TRACEABILITY, SMT, HINT（Excel出力） |
| LV.4 | 問題を把握する | ANCIENT, SUNRISE |
| LV.5 | 将来を予見する | FORESIGHT |
| LV.6 | 連携と強調 | （未対応） |
| 横断 | 共有・管理 | TTS, TECH-BLOG |

---

## 4. ページ設計

### 4-1. アプリ一覧ページ（`/`）

```
┌──────────────────────────────────────────────────┐
│ ヘッダー: [サイト名]  [Apps] [Posts]              │
├──────────────────────────────────────────────────┤
│ 【ビジョンマップ】                                │
│  LV.6 連携と強調         ← 目指す姿              │
│  LV.5 将来を予見する     ← FORESIGHT             │
│  LV.4 問題を把握する     ← ANCIENT, SUNRISE      │
│  LV.3 流れを制御する     ← TRACEABILITY, SMT...  │
│  LV.2 つなげる           ← CHATTRACK, YAGI...    │
│  LV.1 見える             ← QUICK, AXIS           │
│  （各LVに説明文・アプリチップを配置）             │
├──────────────────────────────────────────────────┤
│ 【収集】                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐       │
│  │CHAT │ │XC-G │ │YAGI │ │COLR │ │HINT │       │
│  │TRCK │ │ATE  │ │     │ │S    │ │アップ│       │
│  └─────┘ └─────┘ └─────┘ └─────┘ └─────┘       │
│ 【見える化】                                      │
│  ┌─────┐ ┌─────┐ ...                            │
│ 【活用】                                          │
│  ┌─────┐ ┌─────┐ ┌─────┐                        │
│ 【共有・管理】                                    │
│  ┌─────┐ ┌─────┐                                │
└──────────────────────────────────────────────────┘
```

### 4-2. アプリカードのデザイン

```
┌──────────────────────────┐
│   [banner.svg]           │  ← 横幅フル、高さ固定
├──────────────────────────┤
│ [icon] CHATTRACK         │  ← アプリ名
│ AIチャット型情報管理      │  ← サブタイトル
│                          │
│ 現場トラブルをAIとの会話  │  ← 目的の説明（1〜2文）
│ で即座に記録・共有できる  │    レポートのビジョン文から引用
│                          │
│ [アプリを開く →]         │  ← 外部リンク（coming-soonは無効）
│ [詳細レポート]           │  ← /apps/[slug]への内部リンク
└──────────────────────────┘
```

- `coming-soon`のカードは全体をグレーアウトし「🚧 準備中」バッジを表示
- `network: "internal"` のアプリカードには「🏭 社内ネットワーク限定」バッジを表示
- 「アプリを開く」ボタンは`coming-soon`の場合は`disabled`

### 4-3. アプリ詳細ページ（`/apps/[slug]/`）

ブログ記事ページ（`/posts/[slug]/`）と同一レイアウト。差分のみ記載：

- 記事上部に「アプリを開く」ボタンを追加
- タグの代わりにカテゴリ・LVを表示
- 関連記事の代わりに「同カテゴリのアプリ」を表示（任意）

---

## 5. コンテンツ管理

### ファイル構成

```
tech-blog/
├── content/
│   ├── posts/          # 既存ブログ記事（変更なし）
│   └── apps/           # ★新規
│       ├── ancient.md
│       ├── axis.md
│       ├── chattrack.md
│       ├── colors.md
│       ├── foresight.md
│       ├── hint-excel.md
│       ├── hint-upload.md
│       ├── quick.md
│       ├── smt.md
│       ├── sunrise.md
│       ├── tech-blog.md
│       ├── traceability.md
│       ├── tts.md
│       ├── xc-gate.md
│       └── yagi.md
├── src/
│   ├── app/
│   │   ├── page.tsx          # ★変更: アプリ一覧
│   │   ├── posts/
│   │   │   ├── page.tsx      # ★新規: ブログ一覧（旧 /page.tsx）
│   │   │   └── [slug]/
│   │   │       └── page.tsx  # 既存: ブログ記事詳細（変更なし）
│   │   └── apps/
│   │       └── [slug]/
│   │           └── page.tsx  # ★新規: アプリ詳細
│   ├── components/
│   │   ├── apps/             # ★新規
│   │   │   ├── AppCard.tsx
│   │   │   ├── AppGrid.tsx
│   │   │   └── VisionMap.tsx
│   │   └── articles/         # 既存（流用）
│   └── lib/
│       ├── apps.ts           # ★新規: アプリMarkdownパース
│       └── posts.ts          # 既存（変更なし）
└── public/
    └── apps/                 # ★新規: アプリのアセット
        ├── ancient/
        │   ├── banner.svg
        │   └── icon.svg
        └── ...
```

### Markdownフロントマター仕様

```yaml
---
title: "CHATTRACK"
subtitle: "AIチャット型情報管理システム"
description: "現場トラブルや対処内容をAIとの会話で即座に記録・共有できるシステム"
category: "収集"           # 収集 | 見える化 | 活用 | 共有・管理
level: 2                   # 1〜6（ビジョンマップのLV）、ビジョンマップ非対象は null
status: "active"           # active | coming-soon
appUrl: "https://main.d3dt9ir2fyc53u.amplifyapp.com"
network: "external"        # external | internal（社内ネットワーク限定アプリ）
icon: "/apps/chattrack/icon.svg"
banner: "/apps/chattrack/banner.svg"
date: "2026-03-23"
---

（以下、既存のreport.mdの内容をそのままコピー）
```

---

## 6. ビジョンマップ仕様

画像（スクリーンショット）のLV.1〜6の成熟度モデルをSVG/HTMLで再現する。

| 要素 | 内容 |
|------|------|
| 縦軸 | LV.1（下）〜 LV.6（上）|
| 左側ラベル | データフォーマット統一と標準化 / データ基盤の整理 / 運用自動化・省人化 / 現場管理へのデータ活用 / 全体最適化 / AI活用 |
| 各LV行 | LV番号・テーマ・説明文・配置されたアプリチップ |
| アプリチップ | アプリ名の小さなバッジ（クリックでカード位置にスクロール） |
| 注釈 | 「各業務でAIエージェントを活用し...」の説明文を右側に配置 |
| 現在地マーカー | 実装済みアプリのあるLVを強調表示 |

---

## 7. デプロイ

既存のデプロイフローを流用：
1. `npm run build`（Next.js静的エクスポート）
2. `aws s3 sync out/ s3://blogstack-sitebucket397a1860-enrbrlnhor6y/`
3. CloudFrontキャッシュ無効化

### ブログ記事パスについて

`/posts/[slug]/` は変更なし。コード内の内部リンクも更新不要。

---

## 8. 非機能要件

- 既存ブログの`/posts/[slug]/`パスは変更なし（リダイレクト不要）
- アプリカードのレイアウトはレスポンシブ（モバイル対応）
- 準備中アプリは将来URLが決まり次第、フロントマターの`status`と`appUrl`を更新するだけで有効化できる
- `level: null` のアプリ（TTS、TECH-BLOG）はビジョンマップに表示しない（カード一覧のみに表示）
- 社内ネットワーク限定アプリ（`network: "internal"`）：QUICK、TRACEABILITY、AXIS、SUNRISE はカードに「🏭 社内ネットワーク限定」バッジを表示
