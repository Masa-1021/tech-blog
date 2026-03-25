"use client";

import { useState } from "react";
import { AppCard } from "@/components/apps/AppCard";
import type { App, AppCategory } from "@/types/app";

const APP_CATEGORIES: AppCategory[] = ["収集", "見える化", "活用", "共有・管理"];

const LEVEL_LABELS: Record<number, string> = {
  1: "LV1：見える",
  2: "LV2：つなげる",
  3: "LV3：分析する",
  4: "LV4：AIを活用する",
  5: "LV5：AIが自走する",
};

interface AppGridWithFilterProps {
  apps: App[];
  appsByCategory: Record<AppCategory, App[]>;
}

export function AppGridWithFilter({ apps, appsByCategory }: AppGridWithFilterProps) {
  const [mode, setMode] = useState<"category" | "level">("level");

  const appsByLevel = [1, 2, 3, 4, 5].map((level) => ({
    level,
    apps: apps.filter((app) => app.level === level),
  })).filter(({ apps }) => apps.length > 0);

  const noLevelApps = apps.filter((app) => app.level === null);

  return (
    <div>
      {/* タブ切り替え */}
      <div className="mb-8 flex gap-2">
        <button
          onClick={() => setMode("category")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "category"
              ? "bg-primary-500 text-white"
              : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          カテゴリ別
        </button>
        <button
          onClick={() => setMode("level")}
          className={`rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
            mode === "level"
              ? "bg-primary-500 text-white"
              : "border border-gray-200 text-gray-600 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          }`}
        >
          レベル別
        </button>
      </div>

      {/* カテゴリ別 */}
      {mode === "category" && (
        <div className="space-y-12">
          {APP_CATEGORIES.map((category) => {
            const categoryApps = appsByCategory[category] ?? [];
            if (categoryApps.length === 0) return null;
            return (
              <section key={category} id={`category-${category}`}>
                <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white">
                  <span className="h-6 w-1 rounded-full bg-primary-500" />
                  {category}
                  <span className="text-sm font-normal text-gray-400">{categoryApps.length}件</span>
                </h2>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                  {categoryApps.map((app) => (
                    <AppCard key={app.slug} app={app} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}

      {/* レベル別 */}
      {mode === "level" && (
        <div className="space-y-12">
          {appsByLevel.map(({ level, apps: levelApps }) => (
            <section key={level} id={`level-${level}`}>
              <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white">
                <span className="h-6 w-1 rounded-full bg-primary-500" />
                {LEVEL_LABELS[level]}
                <span className="text-sm font-normal text-gray-400">{levelApps.length}件</span>
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {levelApps.map((app) => (
                  <AppCard key={app.slug} app={app} />
                ))}
              </div>
            </section>
          ))}
          {noLevelApps.length > 0 && (
            <section id="level-other">
              <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white">
                <span className="h-6 w-1 rounded-full bg-gray-400" />
                共有・管理
                <span className="text-sm font-normal text-gray-400">{noLevelApps.length}件</span>
              </h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {noLevelApps.map((app) => (
                  <AppCard key={app.slug} app={app} />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  );
}
