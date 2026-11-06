import "server-only"
import type { StoreProduct } from "@qticaret/types"
import type { ImageView } from "@qticaret/ui"
import { isStoreApiError } from "@/lib/store-api/errors"
import { pathsOf } from "@/lib/store-api/requests"
import { storePublicGet } from "@/lib/store-api/server"
import { imageView } from "./image"

/** A cart's or an order's line as the Store API answers it: its product and variant. */
export interface LineProduct {
  product_id?: string | null
  variant_id?: string | null
}

// Ids per Store API call, as `pathsOf` asks them
const CHUNK = 100

// A shown product's pictures with their versions (adr/0016): no price, the same for every visitor
const LINE_FIELDS = [
  "id",
  "media_assets.url",
  "media_assets.width",
  "media_assets.height",
  "media_assets.alt",
  "media_assets.derivatives",
].join(",")

type LineProductAnswer = Pick<StoreProduct, "id" | "media_assets">

/**
 * The products the shop shows now, with their pictures: the Store API's
 * list answers a published product in its channel only. Shop-wide and
 * kept a minute (`storePublicGet`), so the lines' pages and pictures
 * share one answer.
 */
async function shownProducts(ids: readonly string[]): Promise<LineProductAnswer[]> {
  const shown: LineProductAnswer[] = []
  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK)
    const { products } = await storePublicGet<{ products: LineProductAnswer[] }>(
      "/store/products",
      { id: chunk, fields: LINE_FIELDS, limit: chunk.length }
    )
    shown.push(...products)
  }
  return shown
}

const productIdsOf = (lines: readonly LineProduct[]) => [
  ...new Set(lines.flatMap((line) => line.product_id ?? [])),
]

/**
 * The product pages the lines may link to, by product id: a product the
 * shop shows now with an active path in the URL registry, so the link
 * follows the shop's URL style and a changed slug (docs/13 §2). Both
 * answers are shop-wide, kept a minute (`storePublicGet`). A product gone
 * or unpublished has none; a Store API refusal gives none at all, and the
 * lines read as text.
 */
export async function productPathsOf(
  lines: readonly LineProduct[]
): Promise<ReadonlyMap<string, string>> {
  const ids = productIdsOf(lines)
  if (ids.length === 0) {
    return new Map()
  }
  try {
    const [products, paths] = await Promise.all([shownProducts(ids), pathsOf("product", ids)])
    const shown = new Set(products.map((product) => product.id))
    return new Map(Object.entries(paths).filter(([id]) => shown.has(id)))
  } catch (error) {
    if (isStoreApiError(error)) {
      return new Map()
    }
    throw error
  }
}

/**
 * The lines' pictures with their versions, by the picture's address (a
 * line's thumbnail is one of its product's pictures; docs/21 2026-11-06).
 * The cart, the drawer, the checkout's basket and the order show it
 * small, and the original file is as large as it was uploaded (a
 * product photograph: 100–250 KB). The same answer as `productPathsOf`;
 * none when the backend refuses, and the lines show their thumbnails as
 * they are.
 */
export async function linePicturesOf(
  lines: readonly LineProduct[]
): Promise<ReadonlyMap<string, ImageView>> {
  const ids = productIdsOf(lines)
  if (ids.length === 0) {
    return new Map()
  }
  try {
    const products = await shownProducts(ids)
    return new Map(
      products.flatMap((product) =>
        (product.media_assets ?? []).map((asset) => [asset.url, imageView(asset, "")] as const)
      )
    )
  } catch (error) {
    if (isStoreApiError(error)) {
      return new Map()
    }
    throw error
  }
}

/** A line's thumbnail, with its versions when its picture is known, named by the line's title. */
export function lineImageOf(
  thumbnail: string | null | undefined,
  title: string,
  pictures: ReadonlyMap<string, ImageView> = new Map()
): ImageView | null {
  if (!thumbnail) {
    return null
  }
  const known = pictures.get(thumbnail)
  return known
    ? { ...known, alt: title }
    : { src: thumbnail, alt: title, width: null, height: null, sources: { avif: null, webp: null } }
}

/** A line's product page with its variant chosen (the product page reads `?variant=`); null without one. */
export function linePathOf(paths: ReadonlyMap<string, string>, line: LineProduct): string | null {
  const path = line.product_id ? paths.get(line.product_id) : undefined
  if (!path) {
    return null
  }
  if (!line.variant_id) {
    return path
  }
  return `${path}${path.includes("?") ? "&" : "?"}variant=${encodeURIComponent(line.variant_id)}`
}
