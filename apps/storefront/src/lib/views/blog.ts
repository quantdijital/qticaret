import type { BlogTermLinkView, PaginationView, Translate } from "@qticaret/ui"
import { pagedPath } from "@/lib/seo/paging"

export const BLOG_PATH = "/blog"

const PAGE = /^[1-9]\d{0,3}$/

/** A blog list's page (`/blog`, an archive): the bare address for the first. */
export const blogPagePath = pagedPath

/** `?sayfa=` as a page number; null for anything the address should not hold. */
export function blogPageOf(raw: string | string[] | undefined): number | null {
  if (raw === undefined) {
    return 1
  }
  return typeof raw === "string" && PAGE.test(raw) ? Number(raw) : null
}

/** A blog list's pages, each at its own address (docs/13 §7). */
export function blogPagination(base: string, page: number, pages: number): PaginationView {
  return {
    page,
    pages,
    previous: page > 1 ? blogPagePath(base, page - 1) : null,
    next: page < pages ? blogPagePath(base, page + 1) : null,
    pagePath: Object.fromEntries(
      Array.from({ length: Math.min(pages, 50) }, (_, index) => [
        index + 1,
        blogPagePath(base, index + 1),
      ])
    ),
  }
}

/**
 * The blog's bar of categories (adr/0019 ek 2026-11-03): all posts first,
 * then each category with live posts; the page at `current` (a path)
 * marked. None when the blog files no post under a category.
 */
export function blogTermBar(
  terms: readonly { name: string; path: string }[],
  current: string,
  t: Translate
): BlogTermLinkView[] {
  if (terms.length === 0) {
    return []
  }
  return [{ name: t("blog.all"), path: BLOG_PATH }, ...terms].map((term) => ({
    label: term.name,
    path: term.path,
    current: term.path === current,
  }))
}
