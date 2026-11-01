import type { Resolution, StoreProduct } from "@qticaret/types"
import type { LinkView, SortOptionView } from "@qticaret/ui"
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
  productIdsOf,
} from "@/lib/store-api/requests"
import { childrenOf, subtreeIds } from "@/lib/views/categories"
import { listingPaths, unsupportedListing } from "@/lib/views/listing"
import { breadcrumbsOf, productCards, variantIdsOf } from "@/lib/views/product"
import { paragraphsOf } from "@/lib/views/text"
import { theme } from "@/theme"

type Entity = Extract<Resolution, { type: "entity" }>

interface Listed {
  title: string
  description: string[]
  subcategories: LinkView[]
  products: StoreProduct[]
  total: number
}

const PAGE_SIZE = 24

/** Products of a list given by ids, in that order (brands and landing pages answer ids). */
async function productsByIds(ids: string[]): Promise<StoreProduct[]> {
  if (ids.length === 0) {
    return []
  }
  const { products } = await listProducts({ ids, limit: ids.length })
  const byId = new Map(products.map((product) => [product.id, product]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

async function listed(
  page: Entity,
  offset: number,
  limit: number,
  order: string | undefined
): Promise<Listed> {
  switch (page.entity_type) {
    case "product_category": {
      const categories = await allCategories()
      const category = categories.find((each) => each.id === page.entity_id)
      const children = childrenOf(categories, page.entity_id)
      const [{ products, count }, childPaths] = await Promise.all([
        listProducts({
          categoryIds: subtreeIds(categories, page.entity_id),
          limit,
          offset,
          ...(order ? { order } : {}),
        }),
        pathsOf(
          "product_category",
          children.map((child) => child.id)
        ),
      ])
      return {
        title: category?.name ?? "",
        description: paragraphsOf(category?.description),
        subcategories: children.flatMap((child) => {
          const path = childPaths[child.id]
          return path ? [{ label: child.name, path }] : []
        }),
        products,
        total: count,
      }
    }
    case "brand": {
      const [{ brand }, page_] = await Promise.all([
        brandById(page.entity_id),
        productIdsOf("brands", page.entity_id, { limit, offset }),
      ])
      return {
        title: brand.name,
        description: paragraphsOf(brand.description),
        subcategories: [],
        products: await productsByIds(page_.product_ids),
        total: page_.count,
      }
    }
    case "landing": {
      const [{ landing }, page_] = await Promise.all([
        landingById(page.entity_id),
        productIdsOf("landings", page.entity_id, { limit, offset }),
      ])
      return {
        title: landing.title,
        description: paragraphsOf(landing.html),
        subcategories: [],
        products: await productsByIds(page_.product_ids),
        total: page_.count,
      }
    }
    case "product_collection": {
      const [{ collection }, { products, count }] = await Promise.all([
        collectionById(page.entity_id),
        listProducts({
          collectionIds: [page.entity_id],
          limit,
          offset,
          ...(order ? { order } : {}),
        }),
      ])
      return { title: collection.title, description: [], subcategories: [], products, total: count }
    }
    case "product":
    case "page":
    case "post":
      throw new Error(`${page.entity_type} is not a listing`)
  }
}

/**
 * A category, brand, collection or landing page (docs/13 §7): its products
 * a page at a time, sorted by "recommended" or newest. Filters and price
 * sorts need the backend's listing query (D4); until then such an address
 * says so instead of showing an unfiltered list under a filtered title.
 */
export async function ListingScreen({ page, url }: { page: Entity; url: URL }) {
  const listing = page.listing
  const current = listing?.page ?? 1
  const pageSize = listing?.page_size ?? PAGE_SIZE
  const unsupported = unsupportedListing(listing)
  const order = listing?.sort === "yeni" ? "-created_at" : undefined
  const data = await listed(
    page,
    unsupported ? 0 : (current - 1) * pageSize,
    unsupported ? 0 : pageSize,
    order
  )
  const products = unsupported ? [] : data.products
  const [paths, displays] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(products)),
  ])
  const links = listingPaths(url.pathname, listing?.sort ?? null)
  const pages = Math.max(1, Math.ceil(data.total / pageSize))
  const sort: SortOptionView[] = [
    { label: t("listing.sort_recommended"), path: links.sorted(null), current: !listing?.sort },
    {
      label: t("listing.sort_newest"),
      path: links.sorted("yeni"),
      current: listing?.sort === "yeni",
    },
  ]
  return (
    <>
      <JsonLd blocks={page.seo?.jsonLd ?? []} />
      <theme.ListingPage
        t={t}
        view={{
          title: data.title,
          description: unsupported
            ? [t("listing.unsupported")]
            : current === 1
              ? data.description
              : [],
          breadcrumbs: breadcrumbsOf(page.seo, t("home.label"), data.title),
          subcategories: data.subcategories,
          products: productCards(products, paths, displays),
          total: data.total,
          sort,
          pagination: {
            page: current,
            pages,
            previous: current > 1 ? links.page(current - 1) : null,
            next: current < pages ? links.page(current + 1) : null,
            pagePath: Object.fromEntries(
              Array.from({ length: Math.min(pages, 50) }, (_, index) => [
                index + 1,
                links.page(index + 1),
              ])
            ),
          },
        }}
      />
    </>
  )
}
