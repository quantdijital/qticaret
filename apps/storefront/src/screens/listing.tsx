import { notFound, redirect } from "next/navigation"
import type { Resolution, StoreProduct } from "@qticaret/types"
import type {
  BreadcrumbView,
  CategoryCardView,
  ImageView,
  ListingPageView,
  SortOptionView,
} from "@qticaret/ui"
import { addToCart } from "@/app/actions/cart"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import type { AnalyticsEvent } from "@/lib/analytics/events"
import { listContext, listEvent, listItems } from "@/lib/analytics/payloads"
import { TrackEvents } from "@/lib/analytics/TrackEvents"
import { visitorAmounts } from "@/lib/analytics/tags"
import { currentWholesale } from "@/lib/account/wholesale"
import { t } from "@/lib/i18n"
import { JsonLd } from "@/lib/seo/JsonLd"
import {
  allCategories,
  brandById,
  collectionById,
  landingById,
  listProducts,
  pathsOf,
  priceDisplays,
} from "@/lib/store-api/requests"
import { cardFacts, categoryDescription, collectionDetails } from "@/lib/store-api/extras"
import { listingPage } from "@/lib/store-api/listings"
import type { ListingAnswer, ListingType } from "@/lib/store-api/listings"
import { withCardFacts } from "@/lib/views/card-extras"
import { imageView } from "@/lib/views/image"
import { subcategoryTiles } from "@/lib/views/category-tiles"
import { swatchLookup } from "@/lib/views/color"
import { filterViews } from "@/lib/views/facets"
import { currentLayout, currentShared } from "@/lib/views/layout"
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
import { categoryMainOf } from "@/lib/views/main-sections"
import { byPlacement, sectionViews } from "@/lib/views/sections"
import { listingTextView } from "@/lib/views/listing-text"
import type { ListingTextSource } from "@/lib/views/listing-text"
import { cardOptions, currentTheme } from "@/lib/views/theme-settings"
import { paragraphsOf } from "@/lib/views/text"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

interface Heading {
  title: string
  /** The intro under the title: a landing page's only (adr/0075 §5 leaves it there). */
  description: string[]
  /** A category's, brand's or collection's own text, drawn at the foot of the first page (adr/0075). */
  text?: ListingTextSource
  subcategories: CategoryCardView[]
  /** The listing's own picture (a collection's). */
  image?: ImageView | null
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

/**
 * The listing's own name, words and subcategories. A category's formatted
 * text is one more read, asked beside the tree and only for the first page
 * (`first`), where its text is drawn (adr/0075 §5).
 */
async function headingOf(page: Entity, first: boolean): Promise<Heading> {
  switch (page.entity_type) {
    case "product_category": {
      const [categories, html] = await Promise.all([
        allCategories(),
        first ? categoryDescription(page.entity_id) : null,
      ])
      const category = categories.find((each) => each.id === page.entity_id)
      return {
        title: category?.name ?? "",
        description: [],
        text: { html, plain: category?.description },
        // Each with its picture: the shop's own, else its newest product's photo (adr/0046 Ek 2026-11-05)
        subcategories: await subcategoryTiles(categories, page.entity_id),
      }
    }
    case "brand": {
      const { brand } = await brandById(page.entity_id)
      return {
        title: brand.name,
        description: [],
        text: { html: brand.description_html, plain: brand.description },
        subcategories: [],
      }
    }
    case "landing": {
      const { landing } = await landingById(page.entity_id)
      return { title: landing.title, description: paragraphsOf(landing.html), subcategories: [] }
    }
    case "product_collection": {
      // Its intro and picture are the shop's own (Ürünler > Koleksiyonlar)
      const [{ collection }, details] = await Promise.all([
        collectionById(page.entity_id),
        collectionDetails(page.entity_id),
      ])
      return {
        title: collection.title,
        description: [],
        text: { html: details.description_html, plain: details.description },
        subcategories: [],
        image: details.image ? imageView(details.image, collection.title) : null,
      }
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
    case "post_author":
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
  const state = stateOf(page.listing)
  return (
    <ListingContent
      type={type}
      load={(query) => listingPage(type, page.entity_id, query)}
      state={state}
      url={url}
      heading={() => headingOf(page, state.page === 1)}
      breadcrumbs={(title) => breadcrumbsOf(page.seo, t("home.label"), title)}
      jsonLd={page.seo?.jsonLd ?? []}
      extra={type === "sale" ? { empty: t("sale.empty") } : {}}
    />
  )
}

/**
 * The design's category page sections (adr/0049), above the grid and below
 * it, and the grid itself as the group's main section (Ek 2026-11-14 §7).
 */
async function listingSections() {
  const layout = await currentLayout()
  const { top, bottom } = byPlacement(layout.category)
  const [above, below] = await Promise.all([sectionViews(top, t), sectionViews(bottom, t)])
  return { top: above, bottom: below, main: categoryMainOf(layout.main) }
}

/**
 * One listing's page, whatever lists it: a record resolve found, the
 * whole catalogue, or a site search. The design's category page sections
 * go on every listing (category, brand, collection, landing, sale,
 * `/magaza`), not on a search. A FAQ is shown, never written as `FAQPage`
 * data (docs/13 §5). A page past the last is a 404 (docs/13 §7).
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
    isSearch ? { top: [], bottom: [], main: undefined } : listingSections(),
  ])
  const pages = Math.max(1, Math.ceil(answer.count / answer.page_size))
  const current = state.page
  if (current > pages) {
    notFound()
  }
  const products = await productsByIds(answer.product_ids)
  // One stock read for the page's cards (adr/0046 Ek 2026-11-04)
  const [paths, displays, facts, wholesale] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(products)),
    cardFacts(products.map((product) => product.id)),
    currentWholesale(),
  ])
  // The index holds retail prices only (ADR-0068 §7): a wholesaler's sort says it is the
  // retail order, and the price range, whose bounds would mislead, is not offered
  const retailOnly = wholesale.active
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
      label: t(retailOnly ? "listing.sort_retail_price_up" : "listing.sort_price_up"),
      path: href(withSort(state, "fiyat-artan")),
      current: state.sort === "fiyat-artan",
    },
    {
      label: t(retailOnly ? "listing.sort_retail_price_down" : "listing.sort_price_down"),
      path: href(withSort(state, "fiyat-azalan")),
      current: state.sort === "fiyat-azalan",
    },
  ]
  // The colour names are the design's (adr/0049 Ek 2026-11-06): a preview shows its draft's
  const [shared, options, amounts, settings] = await Promise.all([
    currentShared(),
    cardOptions(),
    visitorAmounts(),
    currentTheme(),
  ])
  const facets = filterViews(
    url.pathname,
    state,
    answer.facets,
    type === "brand",
    t,
    swatchLookup(shared.color_swatches),
    !retailOnly
  )
  const first = current === 1 && facets.active.length === 0
  const cards = withCardFacts(productCards(products, paths, displays, options), facts, options, t)
  // A search is one when asked, not again for each page or filter (as the backend counts it).
  // Prices are the cards' own, an automatic promotion included (adr/0023 Ek 2026-11-05)
  const list =
    products.length > 0
      ? listEvent(type, isSearch ? t("search.title") : heading.title, products, displays)
      : null
  const measured: AnalyticsEvent[] = [
    ...(isSearch && state.q && first ? [{ name: "search" as const, term: state.q }] : []),
    ...(list ? [list] : []),
  ]
  // What a card's quick add puts in the cart (its brand for "added to cart"), and where each card leads
  const quick = cards.flatMap((card) => (card.quickAdd ? [card.quickAdd.variantId] : []))
  return (
    <>
      <TrackEvents
        events={measured}
        visitorAmounts={amounts}
        context={
          list
            ? {
                list: listContext(list, paths),
                ...(quick.length > 0 ? { items: listItems(products, displays, quick) } : {}),
              }
            : null
        }
      />
      <JsonLd blocks={jsonLd} />
      <theme.ListingPage
        t={t}
        subscribe={subscribeNewsletter}
        quickAdd={addToCart}
        view={{
          title: heading.title,
          description: first ? heading.description : [],
          // The record's own text after its products, on its first page, filtered or not (adr/0075 §5)
          footText: isSearch ? null : listingTextView(heading.text, settings.listing_text, current),
          image: first ? (heading.image ?? null) : null,
          sectionsTop: sections.top,
          sectionsBottom: sections.bottom,
          ...(sections.main ? { main: sections.main } : {}),
          breadcrumbs: breadcrumbs(heading.title),
          subcategories: heading.subcategories,
          products: cards,
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
