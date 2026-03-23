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
    level: 6,
    theme: "連携と強調",
    description: "現場実態に応じた生産計画の動的変更",
    leftLabel: "AI活用",
  },
  {
    level: 5,
    theme: "将来を予見する",
    description: "生産計画の精緻化・適正化 / 生産管理・制御サイクルの向上",
    leftLabel: "全体最適化",
  },
  {
    level: 4,
    theme: "問題を把握する",
    description: "適正な標準作業時間（ST）の整備 / ボトルネックの把握と対策",
    leftLabel: "現場管理への\nデータ活用",
  },
  {
    level: 3,
    theme: "流れを制御する",
    description: "生産指示・実績管理の自動化 / 作業時間・品質ばらつきの要因分析",
    leftLabel: "運用自動化\n省人化",
  },
  {
    level: 2,
    theme: "つなげる",
    description: "現場の付帯情報の収集（部材・装置・人・情報など）",
    leftLabel: "データ基盤の\n整理",
  },
  {
    level: 1,
    theme: "見える",
    description: "リソース・生産実績の見える化 / 実績収集の自動化・高度化",
    leftLabel: "データフォーマット\n統一と標準化",
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
                    : level === 6
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
                      : level === 6
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

                  {level === 6 && levelApps.length === 0 && (
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
