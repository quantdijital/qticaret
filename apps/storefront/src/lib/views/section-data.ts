import "server-only"
import type { ProductSource, RelatedSource, StoreProduct } from "@qticaret/types"
import type { LinkView, ProductCardView, Translate } from "@qticaret/ui"
import { allCategories, listProducts, pathsOf, priceDisplays } from "@/lib/store-api/requests"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storeGet } from "@/lib/store-api/server"
import { childrenOf } from "./categories"
import { productCards, variantIdsOf } from "./product"

/**
 * What the design's sections show (adr/0049), fetched live: the products
 * of a rail, the categories and brands named, the newest reviews.
 */

const DATE = new Intl.DateTimeFormat("tr-TR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Istanbul",
})

/** Products by id in the order given; ids with no live product are skipped. */
async function productsInOrder(ids: readonly string[]): Promise<StoreProduct[]> {
  if (ids.length === 0) {
    return []
  }
  const { products } = await listProducts({ limit: ids.length, ids })
  const byId = new Map(products.map((product) => [product.id, product]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

/** A rail's products from the source the shop chose; a hand-picked rail keeps its order. */
export async function railProducts(source: ProductSource, limit: number): Promise<StoreProduct[]> {
  switch (source.kind) {
    case "newest":
      return (await listProducts({ limit, order: "-created_at" })).products
    case "category":
      return (
        await listProducts({ limit, order: "-created_at", categoryIds: [source.category_id] })
      ).products
    case "collection":
      return (
        await listProducts({ limit, order: "-created_at", collectionIds: [source.collection_id] })
      ).products
    case "manual":
      return productsInOrder(source.product_ids.slice(0, limit))
  }
}

/** The product a page shows, for the rails below it. */
export interface ProductContext {
  id: string
  /** Its categories, the first one its own (`same_category`). */
  categoryIds: readonly string[]
}

/** At most `limit` of the items, the current product's own left out. */
export const othersThan = <T extends { id: string }>(
  items: readonly T[],
  currentId: string,
  limit: number
): T[] => items.filter((item) => item.id !== currentId).slice(0, limit)

/**
 * A related rail's products under a product (adr/0049 Ek 2026-11-03): its
 * own category's, a collection's or the shop's choice, never the product
 * itself. One more is asked for so that leaving it out still fills the rail.
 */
export async function relatedProducts(
  source: RelatedSource,
  limit: number,
  product: ProductContext
): Promise<StoreProduct[]> {
  switch (source.kind) {
    case "same_category": {
      const categoryId = product.categoryIds[0]
      if (!categoryId) {
        return []
      }
      const { products } = await listProducts({
        limit: limit + 1,
        order: "-created_at",
        categoryIds: [categoryId],
      })
      return othersThan(products, product.id, limit)
    }
    case "collection": {
      const { products } = await listProducts({
        limit: limit + 1,
        order: "-created_at",
        collectionIds: [source.collection_id],
      })
      return othersThan(products, product.id, limit)
    }
    case "manual": {
      const ids = othersThan(
        source.product_ids.map((id) => ({ id })),
        product.id,
        limit
      )
      return productsInOrder(ids.map(({ id }) => id))
    }
  }
}

/** Cards for a rail: each product's path and live price. */
export async function railCards(products: readonly StoreProduct[]): Promise<ProductCardView[]> {
  if (products.length === 0) {
    return []
  }
  const [paths, displays] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(products)),
  ])
  return productCards(products, paths, displays)
}

export async function categoryLinks(ids: readonly string[]): Promise<LinkView[]> {
  const categories = await allCategories()
  const chosen =
    ids.length > 0
      ? ids.flatMap((id) => categories.find((category) => category.id === id) ?? [])
      : childrenOf(categories, null)
  const paths = await pathsOf(
    "product_category",
    chosen.map((category) => category.id)
  )
  return chosen.flatMap((category) => {
    const path = paths[category.id]
    return path ? [{ label: category.name, path }] : []
  })
}

export async function brandLinks(ids: readonly string[]): Promise<LinkView[]> {
  const { brands } = await storeGet<{ brands: { id: string; name: string }[] }>("/store/brands", {
    limit: 100,
  })
  const chosen =
    ids.length > 0 ? ids.flatMap((id) => brands.find((brand) => brand.id === id) ?? []) : brands
  const paths = await pathsOf(
    "brand",
    chosen.map((brand) => brand.id)
  )
  return chosen.flatMap((brand) => {
    const path = paths[brand.id]
    return path ? [{ label: brand.name, path }] : []
  })
}

interface ReviewsAnswer {
  reviews: {
    product_id: string
    product_title: string
    rating: number
    title: string | null
    body: string
    author_name: string | null
    created_at: string
    verified_purchase: boolean
  }[]
}

export async function reviewViews(limit: number, t: Translate) {
  let answer: ReviewsAnswer
  try {
    answer = await storeGet<ReviewsAnswer>("/store/reviews", { offset: 0, limit })
  } catch (error) {
    if (!isStoreApiError(error)) {
      throw error
    }
    return []
  }
  const paths = await pathsOf(
    "product",
    answer.reviews.map((review) => review.product_id)
  )
  return answer.reviews.map((review) => {
    const path = paths[review.product_id]
    return {
      rating: review.rating,
      title: review.title,
      body: review.body,
      author: review.author_name ?? t("product.anonymous"),
      date: DATE.format(new Date(review.created_at)),
      verified: review.verified_purchase,
      product: path ? { label: review.product_title, path } : null,
    }
  })
}
