import "server-only"
import type { AccountPageView, CategoryCardView } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { listProducts, pathsOf } from "@/lib/store-api/requests"
import { storeGet } from "@/lib/store-api/server"
import { thumbnailOf } from "./account-shared"
import { categoryTiles } from "./category-tiles"
import { railCards } from "./section-data"

interface WishlistAnswer {
  items: { id: string; product: { id: string; title: string; thumbnail: string | null } }[]
}

/** Null for a Store API refusal; anything else is a fault and is thrown. */
const quiet = <T>(promise: Promise<T>): Promise<T | null> =>
  promise.catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  })

/**
 * The live cards of the saved products on sale here (price, stock, as
 * every rail draws them), by product id; none when the catalogue does not
 * answer: the list then shows names and photos only.
 */
async function favoriteCards(ids: readonly string[]) {
  if (ids.length === 0) {
    return new Map<string, NonNullable<AccountPageView["favorites"][number]["card"]>>()
  }
  const listed = await quiet(listProducts({ limit: ids.length, ids }))
  const cards = await railCards(listed?.products ?? [])
  return new Map(cards.map((card) => [card.id, card]))
}

/** The customer's saved products with their pages and, when on sale, their cards. */
export async function customerFavorites(): Promise<AccountPageView["favorites"]> {
  const { items } = await storeGet<WishlistAnswer>("/store/customers/me/wishlist")
  const ids = items.map((item) => item.product.id)
  const [paths, cards] = await Promise.all([pathsOf("product", ids), favoriteCards(ids)])
  return items.flatMap((item) => {
    const path = paths[item.product.id]
    return path
      ? [
          {
            id: item.id,
            title: item.product.title,
            path,
            image: item.product.thumbnail
              ? thumbnailOf(item.product.thumbnail, item.product.title)
              : null,
            card: cards.get(item.product.id) ?? null,
          },
        ]
      : []
  })
}

/**
 * The shop's top categories as picture tiles, for an empty list to start
 * from; none when the catalogue does not answer.
 */
export async function startingCategories(): Promise<CategoryCardView[]> {
  return (await quiet(categoryTiles([]))) ?? []
}
