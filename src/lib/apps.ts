import fs from "fs";
import path from "path";
import matter from "gray-matter";
import type { App, AppFrontmatter, AppCategory } from "@/types/app";

const APPS_DIR = path.join(process.cwd(), "public", "apps");

let cachedAllApps: App[] | null = null;

function getAppSlugs(): string[] {
  if (!fs.existsSync(APPS_DIR)) return [];
  return fs.readdirSync(APPS_DIR).filter((dir) => {
    const indexPath = path.join(APPS_DIR, dir, "index.md");
    return fs.existsSync(indexPath);
  });
}

export function getApp(slug: string): App | null {
  const sanitizedSlug = path.basename(slug);
  const filePath = path.join(APPS_DIR, sanitizedSlug, "index.md");
  if (!fs.existsSync(filePath)) return null;

  const fileContent = fs.readFileSync(filePath, "utf-8");
  const { data, content } = matter(fileContent);
  const frontmatter = data as AppFrontmatter;

  return { slug: sanitizedSlug, ...frontmatter, content };
}

export function getAllApps(): App[] {
  if (cachedAllApps) return cachedAllApps;

  const slugs = getAppSlugs();
  const apps = slugs
    .map((slug) => getApp(slug))
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
  return getAppSlugs();
}

export function getAppGuide(slug: string): string | null {
  const app = getApp(slug);
  if (!app?.guideFile) return null;
  const guidePath = path.join(APPS_DIR, slug, app.guideFile);
  if (!fs.existsSync(guidePath)) return null;
  const content = fs.readFileSync(guidePath, "utf-8");
  // 相対パスの画像参照を /apps/<slug>/ ベースの絶対パスに変換
  return content.replace(/!\[([^\]]*)\]\((?!https?:\/\/|\/)(.*?)\)/g, `![$1](/apps/${slug}/$2)`);
}

export const APP_CATEGORIES: AppCategory[] = [
  "収集",
  "見える化",
  "活用",
  "共有・管理",
];
