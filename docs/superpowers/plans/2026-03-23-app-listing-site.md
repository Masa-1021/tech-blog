# App Listing Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 既存のNext.js tech-blogに製造DXアプリ一覧ページを追加する。ルート`/`をアプリ一覧に変更し、ビジョンマップ（LV.1〜6成熟度モデル）と15枚のアプリカードを表示する。

**Architecture:** 既存の`src/lib/posts.ts`パターンを踏襲して`src/lib/apps.ts`を新規作成し、`content/apps/`配下のMarkdownファイルからアプリデータをパースする。UIは新規コンポーネント（AppCard・AppGrid・VisionMap）で構成し、既存の`ArticleDetail`コンポーネントをアプリ詳細ページに流用する。現在のトップページ（ブログ一覧）は`/posts/`に移動する。

**Tech Stack:** Next.js 15 (static export), TypeScript, Tailwind CSS, gray-matter, Vitest

---

## File Map

### 新規作成
| ファイル | 役割 |
|----------|------|
| `src/types/app.ts` | App型・フロントマター型定義 |
| `src/lib/apps.ts` | content/apps/のパース・クエリ関数 |
| `src/lib/apps.test.ts` | apps.tsのユニットテスト |
| `content/apps/*.md` | 15アプリのMarkdownファイル（データ＋レポート本文） |
| `src/components/apps/AppCard.tsx` | アプリカード1枚 |
| `src/components/apps/AppGrid.tsx` | カテゴリ別カード一覧 |
| `src/components/apps/VisionMap.tsx` | LV.1〜6ビジョンマップ |
| `src/app/apps/[slug]/page.tsx` | アプリ詳細レポートページ |
| `src/app/posts/page.tsx` | ブログ一覧（旧トップページを移動） |
| `src/app/posts/page/[page]/page.tsx` | ブログ一覧2ページ目以降のページネーション |

### 変更
| ファイル | 変更内容 |
|----------|----------|
| `src/app/page.tsx` | アプリ一覧ページに置き換え |
| `src/components/layout/Header.tsx` | ナビに「Apps」「Posts」リンク追加 |
| `public/apps/` | 各アプリのbanner.svg・icon.svgをコピー |

---

## Task 1: App型定義とlib/apps.tsの実装

**Files:**
- Create: `src/types/app.ts`
- Create: `src/lib/apps.ts`
- Create: `src/lib/apps.test.ts`

- [ ] **Step 1: App型を定義する**

`src/types/app.ts`を作成：

```typescript
export type AppStatus = "active" | "coming-soon";
export type AppNetwork = "external" | "internal";
export type AppCategory = "収集" | "見える化" | "活用" | "共有・管理";

export interface AppFrontmatter {
  title: string;
  subtitle: string;
  description: string;
  category: AppCategory;
  level: number | null;
  status: AppStatus;
  appUrl: string | null;
  network: AppNetwork;
  icon: string;
  banner: string;
  date: string;
}

export interface App extends AppFrontmatter {
  slug: string;
  content: string;
}
```

- [ ] **Step 2: テストを先に書く**

`src/lib/apps.test.ts`を作成：

```typescript
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";

// テスト用のfixture appを一時ファイルで作成
const TEST_APPS_DIR = path.join(process.cwd(), "content", "apps-test-fixture");

const fixtureContent = `---
title: "TEST APP"
subtitle: "テスト用アプリ"
description: "テスト説明文"
category: "収集"
level: 2
status: "active"
appUrl: "https://example.com"
network: "external"
icon: "/apps/test/icon.svg"
banner: "/apps/test/banner.svg"
date: "2026-03-23"
---

# テストアプリ

これはテスト用のコンテンツです。
`;

beforeAll(() => {
  fs.mkdirSync(TEST_APPS_DIR, { recursive: true });
  fs.writeFileSync(path.join(TEST_APPS_DIR, "test-app.md"), fixtureContent);
});

afterAll(() => {
  fs.rmSync(TEST_APPS_DIR, { recursive: true, force: true });
});

// apps.tsのAPPS_DIRをオーバーライドするため、関数を直接インポートせず
// ここではgetAllAppsの返り値の形を確認するintegrationテストとする
describe("App markdown parsing", () => {
  it("フロントマターが正しくパースされること", async () => {
    const matter = await import("gray-matter");
    const content = fs.readFileSync(
      path.join(TEST_APPS_DIR, "test-app.md"),
      "utf-8"
    );
    const { data } = matter.default(content);
    expect(data.title).toBe("TEST APP");
    expect(data.category).toBe("収集");
    expect(data.level).toBe(2);
    expect(data.status).toBe("active");
    expect(data.network).toBe("external");
  });

  it("level: nullのアプリが正しくパースされること", async () => {
    const matter = await import("gray-matter");
    const nullLevelContent = `---
title: "NULL LEVEL APP"
subtitle: "横断アプリ"
description: "説明"
category: "共有・管理"
level: null
status: "active"
appUrl: "https://example.com"
network: "external"
icon: "/apps/test/icon.svg"
banner: "/apps/test/banner.svg"
date: "2026-03-23"
---
`;
    const { data } = matter.default(nullLevelContent);
    expect(data.level).toBeNull();
  });
});
```

- [ ] **Step 3: テストを実行して失敗確認**

```bash
cd /c/Users/dw35816/Apps/tech-blog
npm test -- src/lib/apps.test.ts
```

Expected: エラー（apps.test.tsはimportなしなのでparseエラーにはならないが、gray-matterのimportで確認）

- [ ] **Step 4: lib/apps.tsを実装する**

`src/lib/apps.ts`を作成：

```typescript
import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { App, AppFrontmatter, AppCategory } from "@/types/app";

const APPS_DIR = path.join(process.cwd(), "content", "apps");

let cachedAllApps: App[] | null = null;

function getAppFiles(): string[] {
  if (!fs.existsSync(APPS_DIR)) return [];
  return fs.readdirSync(APPS_DIR).filter((file) => file.endsWith(".md"));
}

export function getApp(slug: string): App | null {
  const sanitizedSlug = path.basename(slug);
  const filePath = path.join(APPS_DIR, `${sanitizedSlug}.md`);
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);
  const frontmatter = data as AppFrontmatter;

  return { slug, ...frontmatter, content };
}

export function getAllApps(): App[] {
  if (cachedAllApps) return cachedAllApps;

  const files = getAppFiles();
  const apps = files
    .map((file) => getApp(file.replace(/\.md$/, "")))
    .filter((app): app is App => app !== null);

  cachedAllApps = apps.sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  return cachedAllApps;
}

export function getAppsByCategory(category: AppCategory): App[] {
  return getAllApps().filter((app) => app.category === category);
}

export function getAppsByLevel(level: number): App[] {
  return getAllApps().filter((app) => app.level === level);
}

export function getAllAppSlugs(): string[] {
  return getAppFiles().map((file) => file.replace(/\.md$/, ""));
}

export const APP_CATEGORIES: AppCategory[] = [
  "収集",
  "見える化",
  "活用",
  "共有・管理",
];
```

- [ ] **Step 5: テストを実行してパス確認**

```bash
npm test -- src/lib/apps.test.ts
```

Expected: PASS

- [ ] **Step 6: TypeCheckを実行**

```bash
npm run typecheck
```

Expected: エラーなし

- [ ] **Step 7: コミット**

```bash
cd /c/Users/dw35816/Apps/tech-blog
git add src/types/app.ts src/lib/apps.ts src/lib/apps.test.ts
git commit -m "feat: add App type definitions and lib/apps.ts"
```

---

## Task 2: content/apps/ Markdownファイルの作成

**Files:**
- Create: `content/apps/ancient.md`
- Create: `content/apps/axis.md`
- Create: `content/apps/chattrack.md`
- Create: `content/apps/colors.md`
- Create: `content/apps/foresight.md`
- Create: `content/apps/hint-excel.md`
- Create: `content/apps/hint-upload.md`
- Create: `content/apps/quick.md`
- Create: `content/apps/smt.md`
- Create: `content/apps/sunrise.md`
- Create: `content/apps/tech-blog.md`
- Create: `content/apps/traceability.md`
- Create: `content/apps/tts.md`
- Create: `content/apps/xc-gate.md`
- Create: `content/apps/yagi.md`

- [ ] **Step 1: content/apps/ディレクトリを作成する**

```bash
mkdir -p /c/Users/dw35816/Apps/tech-blog/content/apps
```

- [ ] **Step 2: 各アプリのMarkdownを作成する**

以下15ファイルを作成する。本文は対応する既存レポートMDの内容をコピーする。

**`content/apps/ancient.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\ANCIENT\development-report.md`）
```yaml
---
title: "ANCIENT"
subtitle: "製造業向け画像分析システム"
description: "製造現場の画像データをAIが即座に分析し、熟練者の知見をすべての担当者へ届けるシステム"
category: "活用"
level: 4
status: "active"
appUrl: "https://d31xg64tu1x2pw.cloudfront.net/"
network: "external"
icon: "/apps/ancient/icon.svg"
banner: "/apps/ancient/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/axis.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\AXIS\AXIS_Report.md`）
```yaml
---
title: "AXIS"
subtitle: "AI図面管理システム"
description: "生技・工作が「ここを見れば設備に係る情報はすべてある」という状態を実現するAI図面管理システム"
category: "見える化"
level: 1
status: "active"
appUrl: "http://10.168.124.32:5175/"
network: "internal"
icon: "/apps/axis/icon.svg"
banner: "/apps/axis/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/chattrack.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\CHATTRACK\report.md`）
```yaml
---
title: "CHATTRACK"
subtitle: "AIチャット型情報管理システム"
description: "製造現場の誰もが、AIとの会話だけで、正確な業務情報を即座に記録・共有できるシステム"
category: "収集"
level: 2
status: "active"
appUrl: "https://main.d3dt9ir2fyc53u.amplifyapp.com"
network: "external"
icon: "/apps/chattrack/icon.svg"
banner: "/apps/chattrack/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/colors.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\COLORS\Circle_Detector_開発報告.md`）
```yaml
---
title: "COLORS"
subtitle: "パトライト色検知システム"
description: "製造ラインのパトライト（信号灯）の色をリアルタイムで検知し、稼働状態データを自動収集するシステム"
category: "収集"
level: 2
status: "active"
appUrl: "https://github.com/Masa-1021/color-detector-app"
network: "external"
icon: "/apps/colors/icon.svg"
banner: "/apps/colors/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/foresight.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\FORESIGHT\FORESIGHT_Report.md`）
```yaml
---
title: "FORESIGHT"
subtitle: "予兆保全AIシステム"
description: "品質・稼働データから「壊れる前の異変」を掴み、突発停止ゼロを目指す予兆保全AIシステム"
category: "活用"
level: 5
status: "coming-soon"
appUrl: null
network: "external"
icon: "/apps/foresight/icon.svg"
banner: "/apps/foresight/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/hint-excel.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\HINT\HINT_Report.md`）
```yaml
---
title: "HINT Excel出力ツール"
subtitle: "製造現場データ一覧出力"
description: "製造現場のデータをExcel形式で一覧出力し、集計・分析を効率化するツール"
category: "見える化"
level: 3
status: "active"
appUrl: "https://mitsubishielectricgroup.sharepoint.com/sites/015733/HIMEMSP01573301/hint/SitePages/web%E3%82%A2%E3%83%97%E3%83%AA.aspx?csf=1&web=1&e=KVNvUe"
network: "external"
icon: "/apps/hint/icon.svg"
banner: "/apps/hint/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/hint-upload.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\HINT\HINT_Report.md`と同じリポートを流用）
```yaml
---
title: "HINT 完成データアップロード"
subtitle: "製造完成データ登録ツール"
description: "製造現場の「これ完成」データをスマホ1台でアップロードし、リアルタイムで情報共有するツール"
category: "収集"
level: 2
status: "active"
appUrl: "https://mitsubishielectricgroup.sharepoint.com/sites/015733/HIMEMSP01573301/hint/SitePages/web%E3%82%A2%E3%83%97%E3%83%AA.aspx?csf=1&web=1&e=KVNvUe"
network: "external"
icon: "/apps/hint/icon.svg"
banner: "/apps/hint/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/quick.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\QUICK\QUICK_Report.md`）
```yaml
---
title: "QUICK"
subtitle: "リアルタイム生産管理システム"
description: "hntDBの生産実績データを「見える化」し、現場の意思決定を加速するリアルタイム生産管理システム"
category: "見える化"
level: 1
status: "active"
appUrl: "http://10.168.124.32:8001/"
network: "internal"
icon: "/apps/quick/icon.svg"
banner: "/apps/quick/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/smt.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\SMT\report.md`）
```yaml
---
title: "SMT"
subtitle: "SMTトレーサビリティデータ生成システム"
description: "SMT製造ラインの部品実装履歴を全自動で追跡可能にし、品質問題発生時の影響範囲を即座に特定できる仕組み"
category: "見える化"
level: 3
status: "coming-soon"
appUrl: null
network: "internal"
icon: "/apps/smt/icon.svg"
banner: "/apps/smt/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/sunrise.md`**（本文なし、説明のみ）
```yaml
---
title: "SUNRISE"
subtitle: "品質結果分析システム"
description: "製造ラインの品質検査結果を収集・分析し、不良要因の特定と品質改善を支援するシステム"
category: "活用"
level: 4
status: "active"
appUrl: "http://10.168.124.3:8000/home/"
network: "internal"
icon: "/apps/sunrise/icon.svg"
banner: "/apps/sunrise/banner.svg"
date: "2026-03-23"
---

# SUNRISE - 品質結果分析システム

> **ビジョン：製造ラインの品質データをリアルタイムで分析し、不良ゼロの現場を実現する**

（詳細ドキュメント準備中）
```

**`content/apps/tech-blog.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\TECH-BLOG\report.md`）
```yaml
---
title: "TECH BLOG"
subtitle: "技術情報発信プラットフォーム"
description: "製造DXプロジェクトの技術知識を体系的に整理・発信する技術ブログ"
category: "共有・管理"
level: null
status: "active"
appUrl: "https://dwkpbncqk2toe.cloudfront.net/"
network: "external"
icon: "/apps/tech-blog/icon.svg"
banner: "/apps/tech-blog/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/traceability.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\TRACEABILITY\製造トレーサビリティシステム_開発報告書.md`）
```yaml
---
title: "TRACEABILITY"
subtitle: "製造トレーサビリティシステム"
description: "製造工程の全履歴をデジタルで追跡し、品質問題発生時に即座に影響範囲を特定できるシステム"
category: "見える化"
level: 3
status: "active"
appUrl: "http://10.168.252.16:8080/"
network: "internal"
icon: "/apps/traceability/icon.svg"
banner: "/apps/traceability/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/tts.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\TTS\report.md`）
```yaml
---
title: "TTS"
subtitle: "チームタスク管理システム"
description: "AIと対話しながらチームのすべてのタスクを一つの画面で把握・操作できるシステム"
category: "共有・管理"
level: null
status: "active"
appUrl: "https://d32ji48tzde5hw.cloudfront.net/"
network: "external"
icon: "/apps/tts/icon.svg"
banner: "/apps/tts/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/xc-gate.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\XC-GATE\XC-GATE_Report.md`）
```yaml
---
title: "XC-GATE"
subtitle: "現場帳票ペーパーレス化ソリューション"
description: "手書き帳票をゼロにし、現場データをリアルタイムで経営に活かすペーパーレス化ツール"
category: "収集"
level: 2
status: "coming-soon"
appUrl: null
network: "external"
icon: "/apps/xc-gate/icon.svg"
banner: "/apps/xc-gate/banner.svg"
date: "2026-03-23"
---
```

**`content/apps/yagi.md`**（本文: `C:\Users\dw35816\Apps\digital-transformation\YAGI\T９インプットアプリ_開発報告.md`）
```yaml
---
title: "YAGI"
subtitle: "AI支援メンテナンス記録入力システム"
description: "現場オペレーターの記録入力をAIが支援し、ナレッジを組織の財産へ変えるT9入力システム"
category: "収集"
level: 2
status: "active"
appUrl: "https://d3ridioslsorxr.cloudfront.net/"
network: "external"
icon: "/apps/yagi/icon.svg"
banner: "/apps/yagi/banner.svg"
date: "2026-03-23"
---
```

各ファイルの`---`以降の本文は、対応するレポートMDの内容をそのままコピーする。

- [ ] **Step 3: 動作確認（lib/apps.tsのgetAllApps）**

一時的なスクリプトで確認：
```bash
cd /c/Users/dw35816/Apps/tech-blog
node -e "
const path = require('path');
const fs = require('fs');
const matter = require('gray-matter');
const files = fs.readdirSync('content/apps').filter(f => f.endsWith('.md'));
console.log('App count:', files.length);
files.forEach(f => {
  const { data } = matter(fs.readFileSync('content/apps/' + f, 'utf-8'));
  console.log(f, '->', data.title, data.category, data.level);
});
"
```

Expected: 15ファイルが正しくパースされる

- [ ] **Step 4: コミット**

```bash
git add content/apps/
git commit -m "feat: add 15 app markdown files to content/apps/"
```

---

## Task 3: アプリアセット（banner.svg, icon.svg）のコピー

**Files:**
- Create: `public/apps/<app-name>/banner.svg` および `icon.svg`（15アプリ分）

- [ ] **Step 1: public/appsディレクトリ構造を作成しアセットをコピーする**

各アプリのbanner.svgとicon.svgを`C:\Users\dw35816\Apps\digital-transformation\<APP>\`からコピーする：

```bash
cd /c/Users/dw35816/Apps/tech-blog

# コピー対象とコピー先の対応
declare -A APP_MAP=(
  ["ANCIENT"]="ancient"
  ["AXIS"]="axis"
  ["CHATTRACK"]="chattrack"
  ["COLORS"]="colors"
  ["FORESIGHT"]="foresight"
  ["HINT"]="hint"
  ["QUICK"]="quick"
  ["SMT"]="smt"
  ["TRACEABILITY"]="traceability"
  ["TTS"]="tts"
  ["XC-GATE"]="xc-gate"
  ["YAGI"]="yagi"
)

SRC_BASE="/c/Users/dw35816/Apps/digital-transformation"

for APP_UPPER in "${!APP_MAP[@]}"; do
  APP_LOWER="${APP_MAP[$APP_UPPER]}"
  mkdir -p "public/apps/$APP_LOWER"
  for ASSET in banner.svg icon.svg; do
    SRC="$SRC_BASE/$APP_UPPER/$ASSET"
    DEST="public/apps/$APP_LOWER/$ASSET"
    if [ -f "$SRC" ]; then
      cp "$SRC" "$DEST"
      echo "Copied: $APP_UPPER/$ASSET -> public/apps/$APP_LOWER/$ASSET"
    else
      echo "MISSING: $SRC"
    fi
  done
done

# TECH-BLOGとSUNRISEはアセットがないのでプレースホルダーを作成
mkdir -p public/apps/tech-blog public/apps/sunrise
```

- [ ] **Step 2: アセットが存在しないアプリのプレースホルダーSVGを作成する**

tech-blogとsunriseにプレースホルダーSVGを作成：

```bash
# tech-blog banner
cat > /c/Users/dw35816/Apps/tech-blog/public/apps/tech-blog/banner.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" fill="none">
  <rect width="800" height="200" fill="#1e293b"/>
  <text x="400" y="110" font-size="48" fill="#e2e8f0" text-anchor="middle" font-family="monospace" font-weight="bold">TECH BLOG</text>
</svg>
EOF

# tech-blog icon
cat > /c/Users/dw35816/Apps/tech-blog/public/apps/tech-blog/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="12" fill="#1e293b"/>
  <text x="32" y="42" font-size="24" fill="#e2e8f0" text-anchor="middle" font-family="monospace" font-weight="bold">&lt;/&gt;</text>
</svg>
EOF

# sunrise banner
cat > /c/Users/dw35816/Apps/tech-blog/public/apps/sunrise/banner.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 200" fill="none">
  <rect width="800" height="200" fill="#7c2d12"/>
  <text x="400" y="110" font-size="48" fill="#fed7aa" text-anchor="middle" font-family="sans-serif" font-weight="bold">SUNRISE</text>
</svg>
EOF

# sunrise icon
cat > /c/Users/dw35816/Apps/tech-blog/public/apps/sunrise/icon.svg << 'EOF'
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" fill="none">
  <rect width="64" height="64" rx="12" fill="#7c2d12"/>
  <text x="32" y="42" font-size="28" fill="#fed7aa" text-anchor="middle">🌅</text>
</svg>
EOF
```

- [ ] **Step 3: アセットの確認**

```bash
ls /c/Users/dw35816/Apps/tech-blog/public/apps/
```

Expected: 各アプリのディレクトリが存在し、banner.svgとicon.svgが入っている

- [ ] **Step 4: コミット**

```bash
git add public/apps/
git commit -m "feat: add app assets (banner.svg, icon.svg) to public/apps/"
```

---

## Task 4: AppCardコンポーネントの実装

**Files:**
- Create: `src/components/apps/AppCard.tsx`

- [ ] **Step 1: AppCardコンポーネントを作成する**

`src/components/apps/AppCard.tsx`：

```typescript
import Image from "next/image";
import Link from "next/link";
import type { App } from "@/types/app";

interface AppCardProps {
  app: App;
}

export function AppCard({ app }: AppCardProps) {
  const isComingSoon = app.status === "coming-soon";
  const isInternal = app.network === "internal";

  return (
    <div
      className={`group flex flex-col overflow-hidden rounded-2xl border transition-all duration-200 ${
        isComingSoon
          ? "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-900"
          : "border-gray-200 bg-white shadow-sm hover:shadow-md dark:border-gray-700 dark:bg-gray-800"
      }`}
    >
      {/* バナー画像 */}
      <div className="relative h-32 w-full overflow-hidden bg-gray-100 dark:bg-gray-700">
        <Image
          src={app.banner}
          alt={`${app.title} banner`}
          fill
          className="object-cover"
          unoptimized
        />
        {isComingSoon && (
          <div className="absolute right-2 top-2 rounded-full bg-gray-500 px-2 py-0.5 text-xs font-medium text-white">
            🚧 準備中
          </div>
        )}
        {isInternal && !isComingSoon && (
          <div className="absolute right-2 top-2 rounded-full bg-amber-500 px-2 py-0.5 text-xs font-medium text-white">
            🏭 社内限定
          </div>
        )}
      </div>

      {/* カード本文 */}
      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center gap-2">
          <div className="relative h-8 w-8 flex-shrink-0 overflow-hidden rounded-lg">
            <Image
              src={app.icon}
              alt={`${app.title} icon`}
              fill
              className="object-cover"
              unoptimized
            />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 dark:text-white">{app.title}</h3>
            <p className="text-xs text-gray-500 dark:text-gray-400">{app.subtitle}</p>
          </div>
        </div>

        <p className="flex-1 text-sm text-gray-600 dark:text-gray-300">
          {app.description}
        </p>

        {/* アクションボタン */}
        <div className="mt-2 flex gap-2">
          {isComingSoon ? (
            <span className="flex-1 cursor-not-allowed rounded-lg bg-gray-200 px-3 py-1.5 text-center text-sm font-medium text-gray-400 dark:bg-gray-700 dark:text-gray-500">
              準備中
            </span>
          ) : (
            <a
              href={app.appUrl ?? "#"}
              target="_blank"
              rel="noopener noreferrer"
              className="flex-1 rounded-lg bg-primary-500 px-3 py-1.5 text-center text-sm font-medium text-white transition-colors hover:bg-primary-600"
            >
              アプリを開く →
            </a>
          )}
          <Link
            href={`/apps/${app.slug}`}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-center text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            詳細
          </Link>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeCheckを実行**

```bash
npm run typecheck
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/apps/AppCard.tsx
git commit -m "feat: add AppCard component"
```

---

## Task 5: AppGridコンポーネントの実装

**Files:**
- Create: `src/components/apps/AppGrid.tsx`

- [ ] **Step 1: AppGridコンポーネントを作成する**

`src/components/apps/AppGrid.tsx`：

```typescript
import { AppCard } from "@/components/apps/AppCard";
import { APP_CATEGORIES } from "@/lib/apps";
import type { App, AppCategory } from "@/types/app";

interface AppGridProps {
  appsByCategory: Record<AppCategory, App[]>;
}

export function AppGrid({ appsByCategory }: AppGridProps) {
  return (
    <div className="space-y-12">
      {APP_CATEGORIES.map((category) => {
        const apps = appsByCategory[category] ?? [];
        if (apps.length === 0) return null;
        return (
          <section key={category}>
            <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white">
              <span className="h-6 w-1 rounded-full bg-primary-500" />
              {category}
              <span className="text-sm font-normal text-gray-400">
                {apps.length}件
              </span>
            </h2>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {apps.map((app) => (
                <AppCard key={app.slug} app={app} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: TypeCheckを実行**

```bash
npm run typecheck
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/apps/AppGrid.tsx
git commit -m "feat: add AppGrid component"
```

---

## Task 6: VisionMapコンポーネントの実装

**Files:**
- Create: `src/components/apps/VisionMap.tsx`

- [ ] **Step 1: VisionMapコンポーネントを作成する**

`src/components/apps/VisionMap.tsx`：

```typescript
import Link from "next/link";
import type { App } from "@/types/app";

interface VisionLevel {
  level: number;
  theme: string;
  description: string;
  leftLabel: string;
}

const VISION_LEVELS: VisionLevel[] = [
  {
    level: 6,
    theme: "連携と強調",
    description: "現場実態に応じた生産計画の動的変更",
    leftLabel: "AI活用",
  },
  {
    level: 5,
    theme: "将来を予見する",
    description: "生産計画の精緻化・適正化 / 生産管理・制御サイクルの向上",
    leftLabel: "全体最適化",
  },
  {
    level: 4,
    theme: "問題を把握する",
    description: "適正な標準作業時間（ST）の整備 / ボトルネックの把握と対策",
    leftLabel: "現場管理への\nデータ活用",
  },
  {
    level: 3,
    theme: "流れを制御する",
    description: "生産指示・実績管理の自動化 / 作業時間・品質ばらつきの要因分析",
    leftLabel: "運用自動化\n省人化",
  },
  {
    level: 2,
    theme: "つなげる",
    description: "現場の付帯情報の収集（部材・装置・人・情報など）",
    leftLabel: "データ基盤の\n整理",
  },
  {
    level: 1,
    theme: "見える",
    description: "リソース・生産実績の見える化 / 実績収集の自動化・高度化",
    leftLabel: "データフォーマット\n統一と標準化",
  },
];

interface VisionMapProps {
  apps: App[];
}

export function VisionMap({ apps }: VisionMapProps) {
  const appsByLevel = VISION_LEVELS.reduce<Record<number, App[]>>(
    (acc, { level }) => {
      acc[level] = apps.filter((app) => app.level === level);
      return acc;
    },
    {}
  );

  const hasApps = (level: number) => (appsByLevel[level] ?? []).length > 0;

  return (
    <div className="mb-16 overflow-hidden rounded-2xl border border-gray-200 bg-white dark:border-gray-700 dark:bg-gray-800">
      <div className="border-b border-gray-200 bg-gray-50 px-6 py-4 dark:border-gray-700 dark:bg-gray-900">
        <h2 className="text-lg font-bold text-gray-900 dark:text-white">
          製造DX成熟度ロードマップ
        </h2>
        <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
          各アプリは自律型工場の実現という大きな目標に向かう過程として位置づけられています
        </p>
      </div>

      <div className="p-6">
        <div className="space-y-2">
          {VISION_LEVELS.map(({ level, theme, description, leftLabel }) => {
            const levelApps = appsByLevel[level] ?? [];
            const isActive = hasApps(level);

            return (
              <div
                key={level}
                className={`flex items-start gap-4 rounded-xl p-3 transition-colors ${
                  isActive
                    ? "bg-primary-50 dark:bg-primary-900/20"
                    : level === 6
                    ? "bg-gray-50 opacity-60 dark:bg-gray-900"
                    : "hover:bg-gray-50 dark:hover:bg-gray-700"
                }`}
              >
                {/* 左ラベル */}
                <div className="w-24 flex-shrink-0 text-right">
                  <span className="whitespace-pre-line text-xs text-gray-400 dark:text-gray-500">
                    {leftLabel}
                  </span>
                </div>

                {/* LVバッジ */}
                <div
                  className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-sm font-bold ${
                    isActive
                      ? "bg-primary-500 text-white"
                      : level === 6
                      ? "bg-gray-200 text-gray-400 dark:bg-gray-700 dark:text-gray-500"
                      : "bg-gray-100 text-gray-500 dark:bg-gray-700 dark:text-gray-400"
                  }`}
                >
                  {level}
                </div>

                {/* テーマと説明 */}
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold text-gray-900 dark:text-white">
                      {theme}
                    </span>
                    <span className="text-sm text-gray-500 dark:text-gray-400">
                      — {description}
                    </span>
                  </div>

                  {/* アプリチップ */}
                  {levelApps.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {levelApps.map((app) => (
                        <Link
                          key={app.slug}
                          href={`#category-${app.category}`}
                          className="rounded-full bg-primary-100 px-2.5 py-0.5 text-xs font-medium text-primary-700 transition-colors hover:bg-primary-200 dark:bg-primary-900/40 dark:text-primary-300"
                        >
                          {app.title}
                        </Link>
                      ))}
                    </div>
                  )}

                  {level === 6 && levelApps.length === 0 && (
                    <p className="mt-1 text-xs text-gray-400 dark:text-gray-500">
                      ← 目指す姿（未対応）
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <p className="mt-4 text-right text-xs text-gray-400 dark:text-gray-500">
          各業務でAIエージェントを活用し、各活動の改善サイクルを迅速に回し続けることが生産保全活動高度化のカギ
        </p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: TypeCheckを実行**

```bash
npm run typecheck
```

Expected: エラーなし

- [ ] **Step 3: コミット**

```bash
git add src/components/apps/VisionMap.tsx
git commit -m "feat: add VisionMap component"
```

---

## Task 7: ルート `/` をアプリ一覧ページに変更

**Files:**
- Modify: `src/app/page.tsx`（完全置き換え）

- [ ] **Step 1: 現在のpage.tsxを新しいアプリ一覧ページに置き換える**

`src/app/page.tsx`を以下で置き換える：

```typescript
import { getAllApps, APP_CATEGORIES } from "@/lib/apps";
import { VisionMap } from "@/components/apps/VisionMap";
import { AppGrid } from "@/components/apps/AppGrid";
import type { AppCategory } from "@/types/app";

export default function AppsPage() {
  const apps = getAllApps();
  const appsByCategory = Object.fromEntries(
    APP_CATEGORIES.map((category) => [
      category,
      apps.filter((app) => app.category === category),
    ])
  ) as Record<AppCategory, ReturnType<typeof getAllApps>>;

  return (
    <div>
      <div className="mb-10">
        <h1 className="mb-2 text-3xl font-bold text-gray-900 dark:text-white">
          製造DXアプリ一覧
        </h1>
        <p className="text-gray-500 dark:text-gray-400">
          三田工場 生産技術グループが開発・運用する製造DXアプリケーション群
        </p>
      </div>

      <VisionMap apps={apps} />

      <AppGrid appsByCategory={appsByCategory} />
    </div>
  );
}
```

- [ ] **Step 2: ビルドして確認**

```bash
cd /c/Users/dw35816/Apps/tech-blog
npm run build 2>&1 | tail -20
```

Expected: ビルド成功（エラーなし）

- [ ] **Step 3: コミット**

```bash
git add src/app/page.tsx
git commit -m "feat: replace root page with app listing"
```

---

## Task 8: `/posts/` ブログ一覧ページの追加

**Files:**
- Create: `src/app/posts/page.tsx`

- [ ] **Step 1: posts/page.tsxを作成する**

`src/app/posts/page.tsx`（旧`src/app/page.tsx`の内容をベースに）：

```typescript
import {
  getPaginatedPosts,
  getAllCategories,
  getAllTags,
  getFeaturedPosts,
} from "@/lib/posts";
import { ArticleList } from "@/components/articles/ArticleList";
import { HeroSection } from "@/components/articles/HeroSection";
import { Pagination } from "@/components/ui/Pagination";
import { Sidebar } from "@/components/layout/Sidebar";
import { CategoryList } from "@/components/sidebar/CategoryList";
import { TagList } from "@/components/sidebar/TagList";
import { FeaturedArticles } from "@/components/sidebar/FeaturedArticles";

export default function PostsPage() {
  const { posts, totalPages, currentPage } = getPaginatedPosts(1);
  const categories = getAllCategories();
  const tags = getAllTags();
  const featuredPosts = getFeaturedPosts();
  const heroPost = featuredPosts[0];
  const remainingPosts = heroPost
    ? posts.filter((p) => p.slug !== heroPost.slug)
    : posts;

  return (
    <>
      {heroPost && <HeroSection post={heroPost} />}
      <div className="flex gap-8">
        <div className="min-w-0 flex-1">
          <ArticleList posts={remainingPosts} />
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            basePath="/posts"
          />
        </div>
        <Sidebar>
          <CategoryList categories={categories} />
          <TagList tags={tags} />
          <FeaturedArticles posts={featuredPosts} />
        </Sidebar>
      </div>
    </>
  );
}
```

- [ ] **Step 3: `/posts/page/[page]/page.tsx` を追加する**

`src/app/posts/page/[page]/page.tsx`（既存の`src/app/page/[page]/page.tsx`と同じ構造で`basePath="/posts"`に変更）：

```typescript
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPaginatedPosts,
  getAllCategories,
  getAllTags,
  getFeaturedPosts,
} from "@/lib/posts";
import { ArticleList } from "@/components/articles/ArticleList";
import { Pagination } from "@/components/ui/Pagination";
import { Sidebar } from "@/components/layout/Sidebar";
import { CategoryList } from "@/components/sidebar/CategoryList";
import { TagList } from "@/components/sidebar/TagList";
import { FeaturedArticles } from "@/components/sidebar/FeaturedArticles";

interface PageProps {
  params: Promise<{ page: string }>;
}

export function generateStaticParams() {
  const { totalPages } = getPaginatedPosts(1);
  return Array.from({ length: totalPages - 1 }, (_, i) => ({
    page: String(i + 2),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  return { title: `記事一覧 - ${page}ページ目` };
}

export default async function PostsPaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNum = parseInt(page, 10);

  if (isNaN(pageNum) || pageNum < 2) notFound();

  const { posts, totalPages, currentPage } = getPaginatedPosts(pageNum);

  if (pageNum > totalPages) notFound();

  const categories = getAllCategories();
  const tags = getAllTags();
  const featuredPosts = getFeaturedPosts();

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
        <ArticleList posts={posts} />
        <Pagination
          currentPage={currentPage}
          totalPages={totalPages}
          basePath="/posts"
        />
      </div>
      <Sidebar>
        <CategoryList categories={categories} />
        <TagList tags={tags} />
        <FeaturedArticles posts={featuredPosts} />
      </Sidebar>
    </div>
  );
}
```

- [ ] **Step 4: ビルドして確認**

```bash
npm run build 2>&1 | tail -20
```

Expected: ビルド成功

- [ ] **Step 5: コミット**

```bash
git add src/app/posts/
git commit -m "feat: add /posts/ blog listing page with pagination"
```

---

## Task 9: `/apps/[slug]/` アプリ詳細ページの追加

**Files:**
- Create: `src/app/apps/[slug]/page.tsx`

- [ ] **Step 1: アプリ詳細ページを作成する**

`src/app/apps/[slug]/page.tsx`：

```typescript
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import { getApp, getAllAppSlugs } from "@/lib/apps";
import { markdownToHtml } from "@/lib/markdown";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Sidebar } from "@/components/layout/Sidebar";
import { TableOfContents } from "@/components/sidebar/TableOfContents";

interface AppPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllAppSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: AppPageProps): Promise<Metadata> {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app) return {};
  return {
    title: app.title,
    description: app.description,
  };
}

export default async function AppPage({ params }: AppPageProps) {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app) notFound();

  const { html, headings } = await markdownToHtml(app.content);

  const isComingSoon = app.status === "coming-soon";
  const isInternal = app.network === "internal";

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
        <article className="animate-fade-in-up">
          {/* バナー */}
          <div className="relative -mx-4 mb-8 h-48 overflow-hidden rounded-2xl sm:mx-0">
            <Image
              src={app.banner}
              alt={`${app.title} banner`}
              fill
              className="object-cover"
              unoptimized
              priority
            />
          </div>

          {/* ヘッダー */}
          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <Image
                src={app.icon}
                alt={`${app.title} icon`}
                width={40}
                height={40}
                className="rounded-lg"
                unoptimized
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {app.title}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">{app.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-50 px-3 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {app.category}
              </span>
              {app.level !== null && (
                <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  LV.{app.level}
                </span>
              )}
              {isInternal && (
                <span className="rounded-full bg-amber-50 px-3 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  🏭 社内ネットワーク限定
                </span>
              )}
            </div>

            {/* アクションボタン */}
            <div className="mt-4">
              {isComingSoon ? (
                <span className="inline-block cursor-not-allowed rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                  🚧 準備中
                </span>
              ) : (
                <a
                  href={app.appUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                >
                  アプリを開く →
                </a>
              )}
            </div>
          </header>

          {/* レポート本文 */}
          <CodeBlock
            htmlContent={html}
            className="prose prose-gray max-w-none dark:prose-invert"
          />
        </article>
      </div>
      <Sidebar>
        <TableOfContents headings={headings} />
      </Sidebar>
    </div>
  );
}
```

- [ ] **Step 2: ビルドして確認**

```bash
npm run build 2>&1 | tail -20
```

Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/app/apps/
git commit -m "feat: add /apps/[slug]/ app detail page"
```

---

## Task 10: ヘッダーナビの更新

**Files:**
- Modify: `src/components/layout/Header.tsx`

- [ ] **Step 1: ヘッダーにAppsとPostsのナビリンクを追加する**

`src/components/layout/Header.tsx`の`<nav>`部分を更新：

```typescript
// 変更前
<nav className="hidden items-center gap-1 sm:flex">
  <Link
    href="/"
    className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
  >
    Home
  </Link>
</nav>

// 変更後
<nav className="hidden items-center gap-1 sm:flex">
  <Link
    href="/"
    className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
  >
    Apps
  </Link>
  <Link
    href="/posts"
    className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
  >
    Posts
  </Link>
</nav>
```

また、サイト名も更新する：

```typescript
// 変更前
<span className="font-mono text-xl font-bold tracking-tight text-gray-900 dark:text-white">
  TECH BLOG
</span>

// 変更後
<span className="font-mono text-xl font-bold tracking-tight text-gray-900 dark:text-white">
  DX APPS
</span>
```

- [ ] **Step 2: ビルドして確認**

```bash
npm run build 2>&1 | tail -20
```

Expected: ビルド成功

- [ ] **Step 3: コミット**

```bash
git add src/components/layout/Header.tsx
git commit -m "feat: update header navigation for Apps/Posts"
```

---

## Task 11: デプロイ

**Files:**
- なし（ビルド成果物をS3にアップロード）

- [ ] **Step 1: 最終ビルドを実行する**

```bash
cd /c/Users/dw35816/Apps/tech-blog
npm run build
```

Expected: `out/`ディレクトリが生成される

- [ ] **Step 2: S3にアップロードする**

```bash
aws s3 sync out/ s3://blogstack-sitebucket397a1860-enrbrlnhor6y/ --delete
```

Expected: アップロード完了

- [ ] **Step 3: CloudFrontキャッシュを無効化する**

```bash
aws cloudfront create-invalidation \
  --distribution-id E1KKE3I5GVIO45 \
  --paths "/*"
```

Expected: Invalidation作成完了

- [ ] **Step 4: 動作確認**

ブラウザで以下を確認：
- `https://dwkpbncqk2toe.cloudfront.net/` → アプリ一覧ページが表示される
- `https://dwkpbncqk2toe.cloudfront.net/posts/` → ブログ一覧が表示される
- `https://dwkpbncqk2toe.cloudfront.net/posts/<slug>` → ブログ記事詳細が表示される
- `https://dwkpbncqk2toe.cloudfront.net/apps/<slug>` → アプリ詳細が表示される
