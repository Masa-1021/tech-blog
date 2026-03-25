import { getAllApps, APP_CATEGORIES } from "@/lib/apps";
import { VisionMap } from "@/components/apps/VisionMap";
import { AppGridWithFilter } from "@/components/apps/AppGridWithFilter";
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
        <div className="mb-2 flex items-center justify-between gap-4">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            hint活用アプリ
          </h1>
          <a
            href="https://forms.office.com/pages/responsepage.aspx?id=Ylunxf9LlkynIGYhzpl45eiJMTTs-PNGmin0_oKxwH1UQlpDR0VHUTg4RktONzVEVzhKV042SUdPRCQlQCN0PWcu"
            target="_blank"
            rel="noopener noreferrer"
            className="flex-shrink-0 overflow-hidden rounded-lg border border-gray-200 shadow-sm transition-opacity hover:opacity-80 dark:border-gray-700"
          >
            <img
              src="/apps/hint-helpdesk/banner.png"
              alt="hint ヘルプデスク"
              className="h-16 w-auto"
            />
          </a>
        </div>
        <p className="text-gray-500 dark:text-gray-400">
          hintを活用する人が開発・運用する製造DXアプリケーション群
        </p>
      </div>

      <AppGridWithFilter apps={apps} appsByCategory={appsByCategory} />

      <div className="mt-16">
        <VisionMap apps={apps} />
      </div>
    </div>
  );
}
