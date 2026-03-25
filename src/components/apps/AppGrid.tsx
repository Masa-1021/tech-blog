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
          <section key={category} id={`category-${category}`}>
            <h2 className="mb-6 flex items-center gap-3 text-xl font-bold text-gray-900 dark:text-white">
              <span className="h-6 w-1 rounded-full bg-primary-500" />
              {category}
              <span className="text-sm font-normal text-gray-400">
                {apps.length}件
              </span>
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
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
