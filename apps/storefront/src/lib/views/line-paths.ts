import "server-only"
import { isStoreApiError } from "@/lib/store-api/errors"
import { pathsOf } from "@/lib/store-api/requests"
import { storePublicGet } from "@/lib/store-api/server"

/** A cart's or an order's line as the Store API answers it: its product and variant. */
export interface LineProduct {
  product_id?: string | null
  variant_id?: string | null
}

// Ids per Store API call, as `pathsOf` asks them
const CHUNK = 100

/** The products the shop shows now: the Store API's list answers a published product in its channel only. */
async function shownProducts(ids: readonly string[]): Promise<ReadonlySet<string>> {
  const shown = new Set<string>()
  for (let start = 0; start < ids.length; start += CHUNK) {
    const chunk = ids.slice(start, start + CHUNK)
    const { products } = await storePublicGet<{ products: { id: string }[] }>("/store/products", {
      id: chunk,
      fields: "id",
      limit: chunk.length,
    })
    for (const product of products) {
      shown.add(product.id)
    }
  }
  return shown
}

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
  const ids = [...new Set(lines.flatMap((line) => line.product_id ?? []))]
  if (ids.length === 0) {
    return new Map()
  }
  try {
    const [shown, paths] = await Promise.all([shownProducts(ids), pathsOf("product", ids)])
    return new Map(Object.entries(paths).filter(([id]) => shown.has(id)))
  } catch (error) {
    if (isStoreApiError(error)) {
      return new Map()
    }
    throw error
  }
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
