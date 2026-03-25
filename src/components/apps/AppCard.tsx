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
      className={`group relative flex aspect-square flex-col overflow-hidden rounded-2xl border transition-all duration-300 ${
        isComingSoon
          ? "border-gray-200 bg-gray-50 opacity-60 dark:border-gray-700 dark:bg-gray-900"
          : "border-gray-200 bg-white shadow-sm hover:-translate-y-1 hover:shadow-lg dark:border-gray-700 dark:bg-gray-800"
      }`}
    >
      {/* カード全体リンク（coming-soon以外） */}
      {!isComingSoon && app.appUrl && (
        <a
          href={app.appUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="absolute inset-0 z-0"
          aria-label={`${app.title}を開く`}
        />
      )}

      {/* バナー画像 */}
      <div className="relative aspect-[4/1] w-full shrink-0 overflow-hidden bg-gray-100 dark:bg-gray-700">
        <Image
          src={app.banner}
          alt={`${app.title} banner`}
          fill
          className="object-cover transition-transform duration-500 group-hover:scale-105"
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
      <div className="flex flex-1 flex-col gap-1.5 p-3">
        <div className="flex items-center gap-2">
          <div className="relative h-7 w-7 flex-shrink-0 overflow-hidden rounded-md">
            <Image
              src={app.icon}
              alt={`${app.title} icon`}
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-bold text-gray-900 dark:text-white">{app.title}</h3>
            <p className="truncate text-xs text-gray-500 dark:text-gray-400">{app.subtitle}</p>
          </div>
          {app.level !== null && (
            <span className="flex-shrink-0 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
              LV{app.level}
            </span>
          )}
        </div>

        <p className="line-clamp-3 flex-1 text-xs text-gray-600 dark:text-gray-300">
          {app.description}
        </p>

        {/* アクションボタン */}
        <div className="relative z-10 flex gap-1.5">
          {isComingSoon && (
            <span className="flex-1 cursor-not-allowed rounded-lg bg-gray-200 px-2 py-1 text-center text-xs font-medium text-gray-400 dark:bg-gray-700 dark:text-gray-500">
              準備中
            </span>
          )}
          <Link
            href={`/apps/${app.slug}`}
            className="flex-1 rounded-lg border border-gray-200 px-2 py-1 text-center text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            詳細
          </Link>
          {app.guideFile && (
            <Link
              href={`/apps/${app.slug}/guide/`}
              className="rounded-lg border border-gray-200 px-2 py-1 text-center text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              title="使い方"
            >
              使い方
            </Link>
          )}
          {app.sourceUrl ? (
            <a
              href={app.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="rounded-lg border border-gray-200 px-2 py-1 text-center text-xs font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              title="ソースコード"
            >
              {"</>"}
            </a>
          ) : (
            <span className="cursor-not-allowed rounded-lg border border-gray-100 px-2 py-1 text-center text-xs font-medium text-gray-300 dark:border-gray-800 dark:text-gray-600">
              {"</>"}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
