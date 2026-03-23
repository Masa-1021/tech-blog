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
