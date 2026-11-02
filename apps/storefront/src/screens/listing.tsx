import { notFound, redirect } from "next/navigation"
import type { Resolution, StoreProduct } from "@qticaret/types"
import type { BreadcrumbView, LinkView, ListingPageView, SortOptionView } from "@qticaret/ui"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import type { AnalyticsEvent } from "@/lib/analytics/events"
import { listEvent } from "@/lib/analytics/payloads"
import { TrackEvents } from "@/lib/analytics/TrackEvents"
import { t } from "@/lib/i18n"
import { faqJsonLd } from "@/lib/seo/faq"
import { JsonLd } from "@/lib/seo/JsonLd"
import {
  allCategories,
  brandById,
  collectionById,
  landingById,
  listProducts,
  pathsOf,
  priceDisplays,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { listingPage } from "@/lib/store-api/listings"
import type { ListingAnswer, ListingType } from "@/lib/store-api/listings"
import { childrenOf } from "@/lib/views/categories"
import { swatchLookup } from "@/lib/views/color"
import { filterViews } from "@/lib/views/facets"
import { currentLayout } from "@/lib/views/layout"
import {
  hrefOf,
  listingQueryOf,
  priceAsked,
  stateOf,
  withPage,
  withPrice,
  withSort,
} from "@/lib/views/listing"
import { breadcrumbsOf, productCards, variantIdsOf } from "@/lib/views/product"
import { byPlacement, sectionViews } from "@/lib/views/sections"
import { cardOptions } from "@/lib/views/theme-settings"
import { paragraphsOf } from "@/lib/views/text"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

interface Heading {
  title: string
  description: string[]
  subcategories: LinkView[]
}

/** Products of a list given by ids, in that order. */
async function productsByIds(ids: string[]): Promise<StoreProduct[]> {
  if (ids.length === 0) {
    return []
  }
  const { products } = await listProducts({ ids, limit: ids.length })
  const byId = new Map(products.map((product) => [product.id, product]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

/** The listing's own name, words and subcategories. */
async function headingOf(page: Entity): Promise<Heading> {
  switch (page.entity_type) {
    case "product_category": {
      const categories = await allCategories()
      const category = categories.find((each) => each.id === page.entity_id)
      const children = childrenOf(categories, page.entity_id)
      const childPaths = await pathsOf(
        "product_category",
        children.map((child) => child.id)
      )
      return {
        title: category?.name ?? "",
        description: paragraphsOf(category?.description),
        subcategories: children.flatMap((child) => {
          const path = childPaths[child.id]
          return path ? [{ label: child.name, path }] : []
        }),
      }
    }
    case "brand": {
      const { brand } = await brandById(page.entity_id)
      return { title: brand.name, description: paragraphsOf(brand.description), subcategories: [] }
    }
    case "landing": {
      const { landing } = await landingById(page.entity_id)
      return { title: landing.title, description: paragraphsOf(landing.html), subcategories: [] }
    }
    case "product_collection": {
      const { collection } = await collectionById(page.entity_id)
      return { title: collection.title, description: [], subcategories: [] }
    }
    case "sale":
      // Its name is the backend's (the page's last crumb), as its title is
      return {
        title: page.seo?.breadcrumbs.at(-1)?.name ?? t("sale.title"),
        description: [],
        subcategories: [],
      }
    case "product":
    case "page":
    case "post":
    case "post_category":
    case "post_tag":
      throw new Error(`${page.entity_type} is not a listing`)
  }
}

/**
 * A category, brand, collection or landing page, or the products on sale
 * (docs/13 §7, D4): its products a page at a time, narrowed by the filters
 * and the price range in its address and sorted as asked, beside the
 * filters it offers. Every link is written in the backend's canonical
 * form. The price form's two fields come back as one `fiyat`, by a redirect.
 */
export function ListingScreen({ page, url }: { page: Entity; url: URL }) {
  const type = page.entity_type as ListingType
  return (
    <ListingContent
      type={type}
      load={(query) => listingPage(type, page.entity_id, query)}
      state={stateOf(page.listing)}
      url={url}
      heading={() => headingOf(page)}
      breadcrumbs={(title) => breadcrumbsOf(page.seo, t("home.label"), title)}
      jsonLd={page.seo?.jsonLd ?? []}
      extra={type === "sale" ? { empty: t("sale.empty") } : {}}
    />
  )
}

/** The design's category page sections (adr/0049), above the grid and below it. */
async function listingSections() {
  const { top, bottom } = byPlacement((await currentLayout()).category)
  const [above, below] = await Promise.all([sectionViews(top, t), sectionViews(bottom, t)])
  return { top: above, bottom: below }
}

/**
 * One listing's page, whatever lists it: a record resolve found, the
 * whole catalogue, or a site search. The design's category page sections
 * go on every listing (category, brand, collection, landing, sale,
 * `/magaza`), not on a search; their FAQ data only on the list's first,
 * unfiltered page, where its description shows too. A page past the last
 * is a 404 (docs/13 §7).
 */
export async function ListingContent({
  type,
  load,
  state,
  url,
  heading: loadHeading,
  breadcrumbs,
  jsonLd,
  extra = {},
}: {
  type: ListingType | "search"
  /** The page's answer, by the listing's own query (`query=`). */
  load: (query: string) => Promise<ListingAnswer>
  state: ReturnType<typeof stateOf>
  url: URL
  heading: () => Promise<Heading>
  breadcrumbs: (title: string) => BreadcrumbView[]
  jsonLd: Parameters<typeof JsonLd>[0]["blocks"]
  /** A search's help, a page's own words for an empty list. */
  extra?: Pick<ListingPageView, "search" | "empty">
}) {
  const asked = priceAsked(url.searchParams)
  if (asked !== undefined) {
    redirect(hrefOf(url.pathname, withPrice(state, asked)))
  }
  const isSearch = type === "search"
  const [heading, answer, sections] = await Promise.all([
    loadHeading(),
    load(listingQueryOf(state)),
    isSearch ? { top: [], bottom: [] } : listingSections(),
  ])
  const pages = Math.max(1, Math.ceil(answer.count / answer.page_size))
  const current = state.page
  if (current > pages) {
    notFound()
  }
  const products = await productsByIds(answer.product_ids)
  const [paths, displays] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(products)),
  ])
  const href = (each: typeof state) => hrefOf(url.pathname, each)
  const sort: SortOptionView[] = [
    {
      // A search's own order is relevance
      label: t(isSearch ? "search.sort_relevance" : "listing.sort_recommended"),
      path: href(withSort(state, null)),
      current: !state.sort,
    },
    {
      label: t("listing.sort_newest"),
      path: href(withSort(state, "yeni")),
      current: state.sort === "yeni",
    },
    {
      label: t("listing.sort_price_up"),
      path: href(withSort(state, "fiyat-artan")),
      current: state.sort === "fiyat-artan",
    },
    {
      label: t("listing.sort_price_down"),
      path: href(withSort(state, "fiyat-azalan")),
      current: state.sort === "fiyat-azalan",
    },
  ]
  const [{ storefront }, options] = await Promise.all([storefrontSettings(), cardOptions()])
  const facets = filterViews(
    url.pathname,
    state,
    answer.facets,
    type === "brand",
    t,
    swatchLookup(storefront.color_swatches)
  )
  const first = current === 1 && facets.active.length === 0
  // A search is one when asked, not again for each page or filter (as the backend counts it)
  const measured: AnalyticsEvent[] = [
    ...(isSearch && state.q && first ? [{ name: "search" as const, term: state.q }] : []),
    ...(products.length > 0
      ? [listEvent(type, isSearch ? t("search.title") : heading.title, products)]
      : []),
  ]
  return (
    <>
      <TrackEvents events={measured} />
      <JsonLd
        blocks={[...jsonLd, ...(first ? faqJsonLd([...sections.top, ...sections.bottom]) : [])]}
      />
      <theme.ListingPage
        t={t}
        subscribe={subscribeNewsletter}
        view={{
          title: heading.title,
          description: first ? heading.description : [],
          sectionsTop: sections.top,
          sectionsBottom: sections.bottom,
          breadcrumbs: breadcrumbs(heading.title),
          subcategories: heading.subcategories,
          products: productCards(products, paths, displays, options),
          total: answer.count,
          sort,
          ...facets,
          ...extra,
          pagination: {
            page: current,
            pages,
            previous: current > 1 ? href(withPage(state, current - 1)) : null,
            next: current < pages ? href(withPage(state, current + 1)) : null,
            pagePath: Object.fromEntries(
              Array.from({ length: Math.min(pages, 50) }, (_, index) => [
                index + 1,
                href(withPage(state, index + 1)),
              ])
            ),
          },
        }}
      />
    </>
  )
}
