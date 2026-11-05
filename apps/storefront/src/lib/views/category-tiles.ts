import "server-only"
import type { CategoryCardView } from "@qticaret/ui"
import { subtreeIds } from "./categories"
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
  const { categories, named } = await namedCategories(ids)
  return mapLimited(named, PHOTO_REQUESTS, async ({ id, card }) => {
    if (card.image) {
      return card
    }
    const photo = await newestPhoto(subtreeIds(categories, id))
    return photo ? { ...card, image: photo } : card
  })
}
