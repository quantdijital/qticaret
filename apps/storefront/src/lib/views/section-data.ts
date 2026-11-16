import "server-only"
import type {
  CardVariant,
  RelatedSource,
  StoreLayoutSection,
  StoreBrand,
  StoreProduct,
  StoreReviewPhoto,
} from "@qticaret/types"
import type {
  CategoryCardView,
  CustomerPhotoView,
  ProductCardView,
  SectionBrandView,
  Translate,
} from "@qticaret/ui"
import { t as words } from "@/lib/i18n"
import { allCategories, listProducts, pathsOf, priceDisplays } from "@/lib/store-api/requests"
import { isStoreApiError } from "@/lib/store-api/errors"
import { cardFacts, categoryImages, latestReviewPhotos } from "@/lib/store-api/extras"
import { storeGet } from "@/lib/store-api/server"
import { categoryCard, customerPhotos, reviewPhotos, withCardFacts } from "./card-extras"
import { brandLogo } from "./brands"
import { childrenOf } from "./categories"
import { productCards, variantIdsOf } from "./product"
import { cardOptions } from "./theme-settings"

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
export async function productsInOrder(ids: readonly string[]): Promise<StoreProduct[]> {
  if (ids.length === 0) {
    return []
  }
  const { products } = await listProducts({ limit: ids.length, ids })
  const byId = new Map(products.map((product) => [product.id, product]))
  return ids.flatMap((id) => byId.get(id) ?? [])
}

type RailSection = Pick<
  Extract<StoreLayoutSection, { type: "products" }>,
  "source" | "limit" | "product_ids"
>

/**
 * A rail's products from the source the shop chose; a hand-picked rail
 * keeps its order. A sale or best-seller rail's products were picked by
 * the backend (adr/0049 Ek 2026-11-05) and keep its order; one no longer
 * live here is skipped.
 */
export async function railProducts({
  source,
  limit,
  product_ids,
}: RailSection): Promise<StoreProduct[]> {
  switch (source.kind) {
    case "on_sale":
    case "best_sellers":
      return productsInOrder((product_ids ?? []).slice(0, limit))
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

/**
 * Cards for a rail: each product's path, live price, stock bucket and
 * quick add; drawn as the rail's own card variant when it has one (a
 * product rail's `card_variant`), else as the theme setting says.
 */
export async function railCards(
  products: readonly StoreProduct[],
  variant: CardVariant | null = null
): Promise<ProductCardView[]> {
  if (products.length === 0) {
    return []
  }
  const [paths, displays, shopOptions, facts] = await Promise.all([
    pathsOf(
      "product",
      products.map((product) => product.id)
    ),
    priceDisplays(variantIdsOf(products)),
    cardOptions(),
    cardFacts(products.map((product) => product.id)),
  ])
  const options = variant ? { ...shopOptions, variant } : shopOptions
  return withCardFacts(productCards(products, paths, displays, options), facts, options, words)
}

/** The categories a section names (or the top ones) with their live paths and pictures. */
export async function namedCategories(ids: readonly string[]) {
  const [categories, images] = await Promise.all([allCategories(), categoryImages()])
  const chosen =
    ids.length > 0
      ? ids.flatMap((id) => categories.find((category) => category.id === id) ?? [])
      : childrenOf(categories, null)
  const paths = await pathsOf(
    "product_category",
    chosen.map((category) => category.id)
  )
  const named = chosen.flatMap((category) => {
    const path = paths[category.id]
    return path
      ? [
          {
            id: category.id,
            card: categoryCard({ label: category.name, path }, images.get(category.id)),
          },
        ]
      : []
  })
  return { categories, named }
}

/** The categories a section names (or the top ones), each with its picture when it has one. */
export async function categoryLinks(ids: readonly string[]): Promise<CategoryCardView[]> {
  const { named } = await namedCategories(ids)
  return named.map(({ card }) => card)
}

/**
 * The brands a section names (or every one), each at its page with its
 * logo when it has one: the logo stands for the name, so its alt text is
 * the name (`/markalar` prints the name beside it, alt empty).
 */
export async function brandLinks(ids: readonly string[]): Promise<SectionBrandView[]> {
  const { brands } = await storeGet<{ brands: StoreBrand[] }>("/store/brands", {
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
    if (!path) {
      return []
    }
    const logo = brandLogo(brand, brand.name)
    return logo ? [{ label: brand.name, path, logo }] : [{ label: brand.name, path }]
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
    photos?: StoreReviewPhoto[]
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
    const author = review.author_name ?? t("product.anonymous")
    return {
      rating: review.rating,
      title: review.title,
      body: review.body,
      author,
      date: DATE.format(new Date(review.created_at)),
      verified: review.verified_purchase,
      photos: reviewPhotos(review.photos, author, t),
      product: path ? { label: review.product_title, path } : null,
    }
  })
}

// The home page's strip of customer photos: a row's worth
const CUSTOMER_PHOTOS = 8

/** The newest customer photos on approved reviews (adr/0046 Ek 2026-11-04), each at its product. */
export async function customerPhotoViews(t: Translate): Promise<CustomerPhotoView[]> {
  const photos = await latestReviewPhotos(CUSTOMER_PHOTOS)
  if (photos.length === 0) {
    return []
  }
  const paths = await pathsOf(
    "product",
    photos.map((photo) => photo.product.id)
  )
  return customerPhotos(photos, paths, t)
}
