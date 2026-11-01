import type { Metadata } from "next"
import { notFound, permanentRedirect } from "next/navigation"
import { t } from "@/lib/i18n"
import { blogPosts, siteSeo } from "@/lib/store-api/requests"
import { postCards } from "@/lib/views/posts"
import { theme } from "@/theme"

const PAGE_SIZE = 12
const PAGE = /^[1-9]\d{0,3}$/

type Query = Record<string, string | string[] | undefined>

const pagePath = (page: number) => (page > 1 ? `/blog?sayfa=${String(page)}` : "/blog")

/** `?sayfa=` as a page number; null for anything the address should not hold. */
function pageOf(query: Query): number | null {
  const raw = query["sayfa"]
  if (raw === undefined) {
    return 1
  }
  return typeof raw === "string" && PAGE.test(raw) ? Number(raw) : null
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: Promise<Query>
}): Promise<Metadata> {
  const [site, query] = await Promise.all([siteSeo(), searchParams])
  const page = pageOf(query) ?? 1
  const path = pagePath(page)
  const title = `${t("blog.title")} | ${site.shop.name}`
  return {
    title: { absolute: page > 1 ? `${title} – ${t("listing.page_n", { page })}` : title },
    // docs/13 §7: each page of a list is its own page, its own canonical
    alternates: site.canonical_host ? { canonical: `https://${site.canonical_host}${path}` } : null,
    robots: site.indexing ? "index,follow" : "noindex,nofollow",
  }
}

/**
 * `/blog` (D10): the shop's posts, newest first, twelve a page. `?sayfa=1`
 * answers with the bare address (301), a page past the last with a 404
 * (docs/13 §7), as every list does.
 */
export default async function BlogIndex({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams
  const page = pageOf(query)
  if (page === null) {
    notFound()
  }
  if (query["sayfa"] === "1") {
    permanentRedirect("/blog")
  }
  const { entries, count } = await blogPosts((page - 1) * PAGE_SIZE, PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  if (page > pages) {
    notFound()
  }
  const posts = postCards(entries, t)
  return (
    <theme.BlogIndexPage
      t={t}
      view={{
        title: t("blog.title"),
        breadcrumbs: [
          { label: t("home.label"), path: "/" },
          { label: t("blog.title"), path: null },
        ],
        posts,
        pagination: {
          page,
          pages,
          previous: page > 1 ? pagePath(page - 1) : null,
          next: page < pages ? pagePath(page + 1) : null,
          pagePath: Object.fromEntries(
            Array.from({ length: Math.min(pages, 50) }, (_, index) => [
              index + 1,
              pagePath(index + 1),
            ])
          ),
        },
      }}
    />
  )
}
