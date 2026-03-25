import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getApp, getAllAppSlugs } from "@/lib/apps";
import { markdownToHtml } from "@/lib/markdown";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Sidebar } from "@/components/layout/Sidebar";
import { TableOfContents } from "@/components/sidebar/TableOfContents";

interface AppPageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllAppSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: AppPageProps): Promise<Metadata> {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app) return {};
  return {
    title: app.title,
    description: app.description,
  };
}

export default async function AppPage({ params }: AppPageProps) {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app) notFound();

  const { html, headings } = await markdownToHtml(app.content);

  const isComingSoon = app.status === "coming-soon";
  const isInternal = app.network === "internal";

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
        <article className="animate-fade-in-up">
          {/* バナー */}
          <div className="relative -mx-4 mb-8 h-48 overflow-hidden rounded-2xl sm:mx-0">
            <Image
              src={app.banner}
              alt={`${app.title} banner`}
              fill
              className="object-cover"
              unoptimized
              priority
            />
          </div>

          {/* ヘッダー */}
          <header className="mb-8">
            <div className="mb-3 flex items-center gap-3">
              <Image
                src={app.icon}
                alt={`${app.title} icon`}
                width={40}
                height={40}
                className="rounded-lg"
                unoptimized
              />
              <div>
                <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
                  {app.title}
                </h1>
                <p className="text-gray-500 dark:text-gray-400">{app.subtitle}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full bg-primary-50 px-3 py-0.5 text-xs font-medium text-primary-700 dark:bg-primary-900/30 dark:text-primary-300">
                {app.category}
              </span>
              {app.level !== null && (
                <span className="rounded-full bg-gray-100 px-3 py-0.5 text-xs font-medium text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                  LV.{app.level}
                </span>
              )}
              {isInternal && (
                <span className="rounded-full bg-amber-50 px-3 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                  🏭 社内サーバー
                </span>
              )}
            </div>

            {/* アクションボタン */}
            <div className="mt-4 flex flex-wrap gap-2">
              {isComingSoon ? (
                <span className="inline-block cursor-not-allowed rounded-lg bg-gray-200 px-4 py-2 text-sm font-medium text-gray-400 dark:bg-gray-700 dark:text-gray-500">
                  🚧 準備中
                </span>
              ) : (
                <a
                  href={app.appUrl ?? "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                >
                  アプリを開く →
                </a>
              )}
              {app.guideFile && (
                <Link
                  href={`/apps/${slug}/guide/`}
                  className="inline-block rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  使い方
                </Link>
              )}
              {app.sourceUrl && (
                <a
                  href={app.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
                >
                  {"</>"} ソースコード
                </a>
              )}
            </div>
          </header>

          {/* レポート本文 */}
          <CodeBlock
            htmlContent={html}
            className="prose prose-gray max-w-none dark:prose-invert"
          />
        </article>
      </div>
      <Sidebar>
        <TableOfContents headings={headings} />
      </Sidebar>
    </div>
  );
}
