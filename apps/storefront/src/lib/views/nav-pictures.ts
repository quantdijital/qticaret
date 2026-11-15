import "server-only"
import type { StoreCategory, StoreProduct } from "@qticaret/types"
import type { CategoryCardView, ImageView, NavCategoryView } from "@qticaret/ui"
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

/** How many of a category's newest products a repeated photo looks through for another. */
export const OTHER_PHOTOS = 4

/**
 * The first photos of the newest products in these categories, one per
 * product, newest first (kept a minute, as `categoryGlance`); none when
 * the backend could not answer.
 */
async function newestPhotos(categoryIds: readonly string[]): Promise<ImageView[]> {
  try {
    const { products } = await storePublicGet<{ products: StoreProduct[] }>("/store/products", {
      category_id: [...categoryIds],
      limit: OTHER_PHOTOS,
      order: "-created_at",
      fields: PHOTO_FIELDS,
    })
    return products.flatMap((product) => {
      const [photo] = productImages(product)
      return photo ? [{ ...photo, alt: "" }] : []
    })
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}

/**
 * A top entry's children with no photo shown twice where the data offers
 * another (the dropdown's rows sit one under another): a child whose
 * picture a sibling above it already shows takes the photo of the next
 * newest product in its subtree that no sibling shows yet; without one it
 * keeps its own, never an invented one. The siblings go one after
 * another, as each pick changes what the next has to avoid; only a
 * repeated photo asks the backend again.
 */
async function distinctChildren(
  children: readonly CategoryCardView[],
  categories: readonly StoreCategory[],
  idByPath: ReadonlyMap<string, string>
): Promise<CategoryCardView[]> {
  const shown = new Set<string>()
  const out: CategoryCardView[] = []
  for (const child of children) {
    let picked = child
    const id = idByPath.get(child.path)
    if (child.image && shown.has(child.image.src) && id) {
      const other = (await newestPhotos(subtreeIds(categories, id))).find(
        (photo) => !shown.has(photo.src)
      )
      picked = other ? { ...child, image: other } : child
    }
    if (picked.image) {
      shown.add(picked.image.src)
    }
    out.push(picked)
  }
  return out
}

/**
 * The menu's entries, each without the shop's own picture given its
 * category's newest product photo (adr/0046 Ek 2026-11-04: the
 * dropdown's and the drawer's rows): the top ones and their children in
 * one queue, `PHOTO_REQUESTS` at a time, each answer kept a minute for
 * every visitor; then no photo twice among an entry's children where the
 * data offers another (`distinctChildren`). An entry that is not a
 * category's page keeps none.
 */
export async function withNavPictures(
  menu: readonly NavCategoryView[],
  categories: readonly StoreCategory[],
  paths: Readonly<Record<string, string>>
): Promise<NavCategoryView[]> {
  const idByPath = new Map(Object.entries(paths).map(([id, path]) => [path, id]))
  const pictured = async (entry: CategoryCardView): Promise<CategoryCardView> => {
    const id = entry.image ? undefined : idByPath.get(entry.path)
    if (!id) {
      return entry
    }
    const photo = await newestPhoto(subtreeIds(categories, id))
    return photo ? { ...entry, image: photo } : entry
  }
  // Each top entry, then its children, flat: one limit for all of them
  const flat = menu.flatMap((entry) => [entry, ...entry.children])
  const done = await mapLimited(flat, PHOTO_REQUESTS, pictured)
  let at = 0
  const pictures = menu.map((entry) => {
    const top = done[at++] ?? entry
    const children = entry.children.map((child) => done[at++] ?? child)
    return { ...top, children }
  })
  return mapLimited(pictures, PHOTO_REQUESTS, async (entry) => ({
    ...entry,
    children: await distinctChildren(entry.children, categories, idByPath),
  }))
}
