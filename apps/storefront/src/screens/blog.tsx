import { notFound, permanentRedirect } from "next/navigation"
import { t } from "@/lib/i18n"
import { breadcrumbJsonLd } from "@/lib/seo/breadcrumbs"
import { JsonLd } from "@/lib/seo/JsonLd"
import { blogPosts, siteSeo } from "@/lib/store-api/requests"
import { postCards } from "@/lib/views/posts"
import { theme } from "@/theme"
import type { Query } from "./shop"

const PAGE_SIZE = 12
const PAGE = /^[1-9]\d{0,3}$/

export const blogPagePath = (page: number) => (page > 1 ? `/blog?sayfa=${String(page)}` : "/blog")

/** `?sayfa=` as a page number; null for anything the address should not hold. */
export function blogPageOf(query: Query): number | null {
  const raw = query["sayfa"]
  if (raw === undefined) {
    return 1
  }
  return typeof raw === "string" && PAGE.test(raw) ? Number(raw) : null
}

/**
 * `/blog` (D10): the shop's posts, newest first, twelve a page. `?sayfa=1`
 * answers with the bare address (301), a page past the last with a 404
 * (docs/13 §7), as every list does.
 */
export async function BlogIndexScreen({ query }: { query: Query }) {
  const site = await siteSeo()
  const page = blogPageOf(query)
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
    <>
      <JsonLd
        blocks={breadcrumbJsonLd(site.canonical_host, [
          { name: t("home.label"), path: "/" },
          { name: t("blog.title"), path: "/blog" },
        ])}
      />
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
            previous: page > 1 ? blogPagePath(page - 1) : null,
            next: page < pages ? blogPagePath(page + 1) : null,
            pagePath: Object.fromEntries(
              Array.from({ length: Math.min(pages, 50) }, (_, index) => [
                index + 1,
                blogPagePath(index + 1),
              ])
            ),
          },
        }}
      />
    </>
  )
}
