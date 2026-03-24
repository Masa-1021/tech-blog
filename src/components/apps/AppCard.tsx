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
            🏭 社内サーバー
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
              className="object-contain"
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
