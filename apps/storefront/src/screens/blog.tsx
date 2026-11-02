import { notFound, permanentRedirect } from "next/navigation"
import type { Resolution, StoreContentSummary } from "@qticaret/types"
import type { BlogIndexPageView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { breadcrumbJsonLd } from "@/lib/seo/breadcrumbs"
import { JsonLd } from "@/lib/seo/JsonLd"
import { blogPosts, blogTerms } from "@/lib/store-api/blog"
import { siteSeo } from "@/lib/store-api/requests"
import { blogPageOf, blogPagination, blogTermBar } from "@/lib/views/blog"
import { postCards } from "@/lib/views/posts"
import { breadcrumbsOf } from "@/lib/views/product"
import { paragraphsOf } from "@/lib/views/text"
import { theme } from "@/theme"
import type { Query } from "./shop"

type Entity = Extract<Resolution, { type: "entity" }>
interface Posts {
  entries: StoreContentSummary[]
  count: number
}

const PAGE_SIZE = 12

/**
 * One page of a blog list at `base`, twelve posts a page: `?sayfa=1`
 * answers with the bare address (301), a page past the last or a page
 * that is no number with a 404 (docs/13 §7), as every list does.
 */
async function blogList(
  base: string,
  raw: string | string[] | undefined,
  load: (offset: number, limit: number) => Promise<Posts>
): Promise<Pick<BlogIndexPageView, "posts" | "pagination">> {
  const page = blogPageOf(raw)
  if (page === null) {
    notFound()
  }
  if (raw === "1") {
    permanentRedirect(base)
  }
  const { entries, count } = await load((page - 1) * PAGE_SIZE, PAGE_SIZE)
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  if (page > pages) {
    notFound()
  }
  return { posts: postCards(entries, t), pagination: blogPagination(base, page, pages) }
}

/** `/blog` (D10): the shop's posts, newest first, with its categories as a bar above them. */
export async function BlogIndexScreen({ query }: { query: Query }) {
  const [site, list, categories] = await Promise.all([
    siteSeo(),
    blogList("/blog", query["sayfa"], (offset, limit) => blogPosts(offset, limit)),
    blogTerms("category"),
  ])
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
          ...list,
          terms: blogTermBar(categories, "/blog", t),
          activeTerm: null,
        }}
      />
    </>
  )
}

const NONE: Posts = { entries: [], count: 0 }

/**
 * A blog category's or tag's archive (`/blog/kategori/{handle}`,
 * `/blog/etiket/{handle}`, adr/0019 ek 2026-11-03): its live posts as the
 * blog lists them, its own words on the first page. Resolve found it; its
 * title, robots (noindex while it has no live post) and JSON-LD are the
 * backend's.
 */
export async function BlogArchiveScreen({ page, url }: { page: Entity; url: URL }) {
  const kind = page.entity_type === "post_tag" ? "tag" : "category"
  const [terms, categories] = await Promise.all([blogTerms(kind), blogTerms("category")])
  // Only a term with live posts is listed; one without has none to show
  const term = terms.find((each) => each.id === page.entity_id) ?? null
  const asked = url.searchParams.getAll("sayfa")
  const list = await blogList(url.pathname, asked.length > 1 ? asked : asked[0], (offset, limit) =>
    term ? blogPosts(offset, limit, kind, term.handle) : Promise.resolve(NONE)
  )
  const name = term?.name ?? page.seo?.breadcrumbs.at(-1)?.name ?? ""
  return (
    <>
      <JsonLd blocks={page.seo?.jsonLd ?? []} />
      <theme.BlogIndexPage
        t={t}
        view={{
          title: name,
          breadcrumbs: breadcrumbsOf(page.seo, t("home.label"), name),
          ...list,
          terms: blogTermBar(categories, url.pathname, t),
          activeTerm: {
            kind,
            name,
            description: list.pagination.page === 1 ? paragraphsOf(term?.description) : [],
          },
        }}
      />
    </>
  )
}
