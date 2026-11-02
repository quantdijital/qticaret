import { redirect } from "next/navigation"
import type { Resolution, StoreProduct } from "@qticaret/types"
import type { BreadcrumbView, LinkView, SortOptionView } from "@qticaret/ui"
import { subscribeNewsletter } from "@/app/actions/newsletter"
import { t } from "@/lib/i18n"
import { faqJsonLd } from "@/lib/seo/faq"
import { JsonLd } from "@/lib/seo/JsonLd"
import {
  allCategories,
  brandById,
  collectionById,
  landingById,
  listProducts,
  listingPage,
  pathsOf,
  priceDisplays,
  storefrontSettings,
} from "@/lib/store-api/requests"
import { childrenOf } from "@/lib/views/categories"
import { swatchLookup } from "@/lib/views/color"
import { filterViews } from "@/lib/views/facets"
import { currentLayout } from "@/lib/views/layout"
import {
  hrefOf,
  priceAsked,
  searchOf,
  stateOf,
  withPage,
  withPrice,
  withSort,
} from "@/lib/views/listing"
import { breadcrumbsOf, productCards, variantIdsOf } from "@/lib/views/product"
import { byPlacement, sectionViews } from "@/lib/views/sections"
import { paragraphsOf } from "@/lib/views/text"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>
export type ListingType = "product_category" | "product_collection" | "brand" | "landing" | "all"

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
    case "product":
    case "page":
    case "post":
      throw new Error(`${page.entity_type} is not a listing`)
  }
}

/**
 * A category, brand, collection or landing page (docs/13 §7, D4): its
 * products a page at a time, narrowed by the filters and the price range
 * in its address and sorted as asked, beside the filters it offers. Every
 * link is written in the backend's canonical form. The price form's two
 * fields come back as one `fiyat`, by a redirect.
 */
export function ListingScreen({ page, url }: { page: Entity; url: URL }) {
  return (
    <ListingContent
      type={page.entity_type as ListingType}
      id={page.entity_id}
      state={stateOf(page.listing)}
      url={url}
      heading={() => headingOf(page)}
      breadcrumbs={(title) => breadcrumbsOf(page.seo, t("home.label"), title)}
      jsonLd={page.seo?.jsonLd ?? []}
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
 * One listing's page, whatever lists it: a record resolve found, or the
 * whole catalogue. The design's category page sections go on every kind
 * (category, brand, collection, landing, `/magaza`); their FAQ data only
 * on the list's first, unfiltered page, where its description shows too.
 */
export async function ListingContent({
  type,
  id,
  state,
  url,
  heading: loadHeading,
  breadcrumbs,
  jsonLd,
}: {
  type: ListingType
  id: string
  state: ReturnType<typeof stateOf>
  url: URL
  heading: () => Promise<Heading>
  breadcrumbs: (title: string) => BreadcrumbView[]
  jsonLd: Parameters<typeof JsonLd>[0]["blocks"]
}) {
  const asked = priceAsked(url.searchParams)
  if (asked !== undefined) {
    redirect(hrefOf(url.pathname, withPrice(state, asked)))
  }
  const [heading, answer, sections] = await Promise.all([
    loadHeading(),
    listingPage(type, id, searchOf(state)),
    listingSections(),
  ])
  const products = await productsByIds(answer.product_ids)
  const [paths, displays] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(products)),
  ])
  const pages = Math.max(1, Math.ceil(answer.count / answer.page_size))
  const current = state.page
  const href = (each: typeof state) => hrefOf(url.pathname, each)
  const sort: SortOptionView[] = [
    {
      label: t("listing.sort_recommended"),
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
  const { storefront } = await storefrontSettings()
  const facets = filterViews(
    url.pathname,
    state,
    answer.facets,
    type === "brand",
    t,
    swatchLookup(storefront.color_swatches)
  )
  const first = current === 1 && facets.active.length === 0
  return (
    <>
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
          products: productCards(products, paths, displays),
          total: answer.count,
          sort,
          ...facets,
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
