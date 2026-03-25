import { notFound } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { getApp, getAppGuide, getAllAppSlugs } from "@/lib/apps";
import { markdownToHtml } from "@/lib/markdown";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Sidebar } from "@/components/layout/Sidebar";
import { TableOfContents } from "@/components/sidebar/TableOfContents";

interface GuidePageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllAppSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: GuidePageProps): Promise<Metadata> {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app) return {};
  return {
    title: `${app.title} 使い方`,
    description: `${app.title}の使い方ガイド`,
  };
}

export default async function GuidePage({ params }: GuidePageProps) {
  const { slug } = await params;
  const app = getApp(slug);
  if (!app) notFound();

  const guideContent = getAppGuide(slug);
  if (!guideContent) notFound();

  const { html, headings } = await markdownToHtml(guideContent);

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
                  {app.title} 使い方ガイド
                </h1>
                <p className="text-gray-500 dark:text-gray-400">{app.subtitle}</p>
              </div>
            </div>

            {/* ナビゲーション */}
            <div className="flex flex-wrap gap-2">
              <Link
                href={`/apps/${slug}`}
                className="inline-block rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
              >
                ← 概要に戻る
              </Link>
              {app.appUrl && (
                <a
                  href={app.appUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-block rounded-lg bg-primary-500 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-primary-600"
                >
                  アプリを開く →
                </a>
              )}
            </div>
          </header>

          {/* ガイド本文 */}
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
