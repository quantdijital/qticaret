import "server-only"
import type { StoreCategory, StoreProduct } from "@qticaret/types"
import type { ImageView, NavCategoryView } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { storePublicGet } from "@/lib/store-api/server"
import { subtreeIds } from "./categories"
import { productImages } from "./image"
import { mapLimited } from "./limited"

/** How many categories ask for their newest photo at a time. */
export const PHOTO_REQUESTS = 6

// A photo's fields only: no price, so the answer is the same for every visitor
const PHOTO_FIELDS = [
  "id",
  "title",
  "thumbnail",
  "images.id",
  "images.url",
  "images.rank",
  "media_assets.id",
  "media_assets.url",
  "media_assets.width",
  "media_assets.height",
  "media_assets.alt",
  "media_assets.derivatives",
].join(",")

/** A category's products at a glance: its newest product's photo and how many it holds. */
export interface CategoryGlance {
  photo: ImageView | null
  /** Every product in it (and below it, as asked); null when the answer had no count. */
  count: number | null
}

/**
 * The newest product in these categories, with their count: one request,
 * the same for every visitor and kept a minute (`storePublicGet`); null
 * when the backend could not answer. The photo's own words are left out:
 * the name beside it says what it is.
 */
export async function categoryGlance(
  categoryIds: readonly string[]
): Promise<CategoryGlance | null> {
  try {
    const { products, count } = await storePublicGet<{ products: StoreProduct[]; count?: number }>(
      "/store/products",
      {
        category_id: [...categoryIds],
        limit: 1,
        order: "-created_at",
        fields: PHOTO_FIELDS,
      }
    )
    const [photo] = products[0] ? productImages(products[0]) : []
    return {
      photo: photo ? { ...photo, alt: "" } : null,
      count: typeof count === "number" && Number.isFinite(count) ? count : null,
    }
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

/**
 * The first photo of the newest product in these categories (the same
 * request as `categoryGlance`, so they share the minute's answer); null
 * when none has a photo or the backend could not answer.
 */
export async function newestPhoto(categoryIds: readonly string[]): Promise<ImageView | null> {
  return (await categoryGlance(categoryIds))?.photo ?? null
}

/**
 * The menu's top entries, each without the shop's own picture given its
 * category's newest product photo (adr/0046 Ek 2026-11-04: the mega
 * panel's picture, the drawer's rows). An entry that is not a category's
 * page keeps none.
 */
export async function withNavPictures(
  menu: readonly NavCategoryView[],
  categories: readonly StoreCategory[],
  paths: Readonly<Record<string, string>>
): Promise<NavCategoryView[]> {
  const idByPath = new Map(Object.entries(paths).map(([id, path]) => [path, id]))
  return mapLimited(menu, PHOTO_REQUESTS, async (entry) => {
    const id = entry.image ? undefined : idByPath.get(entry.path)
    if (!id) {
      return entry
    }
    const photo = await newestPhoto(subtreeIds(categories, id))
    return photo ? { ...entry, image: photo } : entry
  })
}
