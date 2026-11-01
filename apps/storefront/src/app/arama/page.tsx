import type { Metadata } from "next"
import { notFound } from "next/navigation"
import { t } from "@/lib/i18n"
import { robotsOnly } from "@/lib/seo/metadata"
import { listProducts, pathsOf, priceDisplays } from "@/lib/store-api/requests"
import { productCards, variantIdsOf } from "@/lib/views/product"
import { theme } from "@/theme"

// docs/13 §7: search results are noindex,follow (backend `system_pages`)
export const metadata: Metadata = robotsOnly("noindex,follow", t("search.title"))

const PAGE_SIZE = 24
const MAX_QUERY = 100
const PAGE = /^[1-9]\d{0,3}$/

type Query = Record<string, string | string[] | undefined>

const single = (value: string | string[] | undefined): string =>
  typeof value === "string" ? value : ""

const searchPath = (q: string, page: number): string => {
  const params = new URLSearchParams({ q })
  if (page > 1) {
    params.set("sayfa", String(page))
  }
  return `/arama?${params.toString()}`
}

/**
 * `/arama?q=` (D10 will bring Meilisearch): Medusa's keyword search over
 * titles and descriptions, a page at a time. The backend counts the term
 * for the shop's search report (F10). A page past the last is a 404.
 */
export default async function SearchPage({ searchParams }: { searchParams: Promise<Query> }) {
  const query = await searchParams
  const q = single(query["q"]).trim().slice(0, MAX_QUERY)
  const rawPage = single(query["sayfa"])
  const current = PAGE.test(rawPage) ? Number(rawPage) : 1
  const { products, count } = q
    ? await listProducts({ q, limit: PAGE_SIZE, offset: (current - 1) * PAGE_SIZE })
    : { products: [], count: 0 }
  const pages = Math.max(1, Math.ceil(count / PAGE_SIZE))
  if (current > pages) {
    notFound()
  }
  const [paths, displays] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(products)),
  ])
  const title = q ? t("search.results_for", { q }) : t("search.title")
  return (
    <theme.ListingPage
      t={t}
      view={{
        title,
        description: !q ? [t("search.prompt")] : count === 0 ? [t("search.none", { q })] : [],
        breadcrumbs: [
          { label: t("home.label"), path: "/" },
          { label: t("search.title"), path: null },
        ],
        subcategories: [],
        products: productCards(products, paths, displays),
        total: count,
        sort: [],
        pagination: {
          page: current,
          pages,
          previous: current > 1 ? searchPath(q, current - 1) : null,
          next: current < pages ? searchPath(q, current + 1) : null,
          pagePath: Object.fromEntries(
            Array.from({ length: Math.min(pages, 50) }, (_, index) => [
              index + 1,
              searchPath(q, index + 1),
            ])
          ),
        },
      }}
    />
  )
}
