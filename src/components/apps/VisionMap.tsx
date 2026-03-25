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
    level: 1,
    theme: "見える",
    description: "リソース・生産実績の見える化 / 実績収集の自動化・高度化",
    leftLabel: "データフォーマット\n統一と標準化",
  },
  {
    level: 2,
    theme: "つなげる",
    description: "現場の付帯情報の収集（部材・装置・人・情報など）",
    leftLabel: "データ基盤の\n整理",
  },
  {
    level: 3,
    theme: "分析する",
    description: "蓄積データを活用し、ボトルネック把握・要因分析・意思決定を支援",
    leftLabel: "データ活用\n意思決定支援",
  },
  {
    level: 4,
    theme: "AIを活用する",
    description: "予兆保全・需要予測など、AIが業務判断を支援・自動化",
    leftLabel: "AI活用\n業務自動化",
  },
  {
    level: 5,
    theme: "AIが自走する",
    description: "AIエージェントが自律的に判断・実行し、工場全体を最適化",
    leftLabel: "自律型工場\n完全自動化",
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
                    : level === 5
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
                      : level === 5
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

                  {level === 5 && levelApps.length === 0 && (
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
