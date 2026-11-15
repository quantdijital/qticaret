import "server-only"
import type { StoreCategory } from "@qticaret/types"
import type { CategoryCardView } from "@qticaret/ui"
import { childrenOf, subtreeIds } from "./categories"
import { mapLimited } from "./limited"
import { newestPhoto, PHOTO_REQUESTS } from "./nav-pictures"
import { namedCategories } from "./section-data"

/**
 * The home page's category tiles (docs/tema/yon-2026-11-05.md § Reyon
 * kartı): the categories a section names, else the top ones, each with
 * the shop's own picture or, without one, the photo of its newest product
 * (in it or a category under it), so every tile shows a picture. The
 * requests run `PHOTO_REQUESTS` at a time and are kept a minute for every
 * visitor. A category with no pictured product, or one the backend could
 * not answer for, keeps its name only. The photos are the shop's own
 * catalogue.
 */
export async function categoryTiles(ids: readonly string[]): Promise<CategoryCardView[]> {
  return (await picturedCategories(ids)).map(({ card }) => card)
}

/**
 * A category page's tiles: its own children, none without any. An empty
 * list would ask `categoryTiles` for the top categories, the page itself
 * among them (Tezgâh audit Z-05).
 */
export async function subcategoryTiles(
  categories: readonly StoreCategory[],
  parentId: string
): Promise<CategoryCardView[]> {
  const ids = childrenOf(categories, parentId).map((child) => child.id)
  return ids.length > 0 ? categoryTiles(ids) : []
}

/**
 * `categoryTiles` with each tile's category id beside it (its count, a
 * tile's own picture). With a `limit` only that many are kept, and only
 * their photos are asked for.
 */
export async function picturedCategories(
  ids: readonly string[],
  limit?: number
): Promise<{ id: string; card: CategoryCardView }[]> {
  const { categories, named } = await namedCategories(ids)
  const kept = limit === undefined ? named : named.slice(0, limit)
  return mapLimited(kept, PHOTO_REQUESTS, async ({ id, card }) => {
    if (card.image) {
      return { id, card }
    }
    const photo = await newestPhoto(subtreeIds(categories, id))
    return { id, card: photo ? { ...card, image: photo } : card }
  })
}

/**
 * The shop's top categories with their pictures, the way on from a missing
 * (404) or removed (410) page. Such a page never fails for want of them:
 * unanswered, it has none.
 */
export async function waysOn(): Promise<CategoryCardView[]> {
  try {
    return await categoryTiles([])
  } catch {
    return []
  }
}
