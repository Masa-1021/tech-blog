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

  // Note: Unlike posts.ts which filters by `published`, apps are always returned
  // regardless of status. "coming-soon" apps are shown in the UI with a disabled
  // button — filtering happens at the component level, not here.
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
