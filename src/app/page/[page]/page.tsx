import { notFound } from "next/navigation";
import type { Metadata } from "next";
import {
  getPaginatedPosts,
  getAllCategories,
  getAllTags,
  getFeaturedPosts,
} from "@/lib/posts";
import { ArticleList } from "@/components/articles/ArticleList";
import { Pagination } from "@/components/ui/Pagination";
import { Sidebar } from "@/components/layout/Sidebar";
import { CategoryList } from "@/components/sidebar/CategoryList";
import { TagList } from "@/components/sidebar/TagList";
import { FeaturedArticles } from "@/components/sidebar/FeaturedArticles";

interface PageProps {
  params: Promise<{ page: string }>;
}

export function generateStaticParams() {
  const { totalPages } = getPaginatedPosts(1);
  return Array.from({ length: totalPages - 1 }, (_, i) => ({
    page: String(i + 2),
  }));
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { page } = await params;
  return { title: `記事一覧 - ${page}ページ目` };
}

export default async function PaginatedPage({ params }: PageProps) {
  const { page } = await params;
  const pageNum = parseInt(page, 10);

  if (isNaN(pageNum) || pageNum < 2) notFound();

  const { posts, totalPages, currentPage } = getPaginatedPosts(pageNum);

  if (pageNum > totalPages) notFound();

  const categories = getAllCategories();
  const tags = getAllTags();
  const featuredPosts = getFeaturedPosts();

  return (
    <div className="flex gap-8">
      <div className="min-w-0 flex-1">
        <ArticleList posts={posts} />
        <Pagination currentPage={currentPage} totalPages={totalPages} basePath="" />
      </div>
      <Sidebar>
        <CategoryList categories={categories} />
        <TagList tags={tags} />
        <FeaturedArticles posts={featuredPosts} />
      </Sidebar>
    </div>
  );
}
