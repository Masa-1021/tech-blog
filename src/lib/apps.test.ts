import { describe, it, expect, beforeAll, afterAll } from "vitest";
import fs from "fs";
import path from "path";

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
