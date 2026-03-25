import Link from "next/link";
import { SearchModal } from "@/components/ui/SearchModal";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { getSearchIndex } from "@/lib/posts";

export function Header() {
  const searchIndex = getSearchIndex();

  return (
    <header className="sticky top-0 z-40 border-b border-gray-200 bg-white/80 backdrop-blur-lg dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 transition-colors hover:opacity-80">
          <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary-500">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
              <rect x="1"  y="1"  width="5" height="5" rx="1.5" fill="white"/>
              <rect x="7"  y="1"  width="5" height="5" rx="1.5" fill="white" opacity="0.75"/>
              <rect x="13" y="1"  width="5" height="5" rx="1.5" fill="white" opacity="0.5"/>
              <rect x="1"  y="7"  width="5" height="5" rx="1.5" fill="white" opacity="0.75"/>
              <rect x="7"  y="7"  width="5" height="5" rx="1.5" fill="white"/>
              <rect x="13" y="7"  width="5" height="5" rx="1.5" fill="white" opacity="0.75"/>
              <rect x="1"  y="13" width="5" height="5" rx="1.5" fill="white" opacity="0.5"/>
              <rect x="7"  y="13" width="5" height="5" rx="1.5" fill="white" opacity="0.75"/>
              <rect x="13" y="13" width="5" height="5" rx="1.5" fill="white"/>
            </svg>
          </span>
          <span className="font-mono text-xl font-bold tracking-tight text-gray-900 dark:text-white">
            DX APPS
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <nav className="hidden items-center gap-1 sm:flex">
            <Link
              href="/"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              Apps
            </Link>
            <Link
              href="/posts"
              className="rounded-lg px-3 py-1.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
            >
              Posts
            </Link>
          </nav>
          <SearchModal searchIndex={searchIndex} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
