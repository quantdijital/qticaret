import "server-only"
import { randomUUID } from "node:crypto"
import type { StoreAddonSelection, StoreProductAddon } from "@qticaret/types"
import { isStoreApiError } from "../store-api/errors"
import { storeDelete, storeGet, storePost, storePublicFind } from "../store-api/server"
import { addLine } from "./cart"
import { cartIdFromCookie } from "./cookie"

/**
 * Product add-ons in the cart (adr/0052): a line is added through the core
 * route, then its picks through `…/line-items/:line_id/addons`, which
 * prices them on the server. Only the picks are sent (CLAUDE.md rule 5).
 */

/**
 * A product's add-ons; null while the shop offers none: the route answers
 * 404 with the shop's add-ons off, as for a product that is not this
 * shop's. Shop-wide, kept a minute like the backend's own cache header.
 */
export async function productAddons(productId: string): Promise<StoreProductAddon[] | null> {
  const answer = await storePublicFind<{ addons: StoreProductAddon[] }>(
    `/store/products/${encodeURIComponent(productId)}/addons`
  )
  return answer?.addons ?? null
}

/** A product's add-ons for a page; none on any failure to read them (the payment checks again). */
export async function productAddonsOrNone(productId: string): Promise<StoreProductAddon[]> {
  try {
    return (await productAddons(productId)) ?? []
  } catch (error) {
    if (isStoreApiError(error)) {
      return []
    }
    throw error
  }
}

/** Each product's add-ons, for the cart's lines; a product without any is left out. */
export async function addonsOfProducts(
  productIds: readonly string[]
): Promise<Map<string, StoreProductAddon[]>> {
  const unique = [...new Set(productIds)]
  const found = await Promise.all(
    unique.map(async (id) => [id, await productAddonsOrNone(id)] as const)
  )
  return new Map(found.filter(([, addons]) => addons.length > 0))
}

// Medusa merges a plain add into a plain line of the same variant: a mark
// of this add's own keeps the picks on the units bought with them
const LINE_MARK = "addon_line"

const linePath = (cartId: string, lineId: string) =>
  `/store/carts/${encodeURIComponent(cartId)}/line-items/${encodeURIComponent(lineId)}`

/**
 * A variant into the cart with its picks: a line of its own, then its
 * picks. A refusal of the picks takes the line back (the form shows why,
 * and sending it again adds no second line).
 */
export async function addAddonLine(
  variantId: string,
  quantity: number,
  selections: readonly StoreAddonSelection[]
): Promise<void> {
  const mark = randomUUID()
  const cartId = await addLine(variantId, quantity, { [LINE_MARK]: mark })
  const { cart } = await storeGet<{
    cart: { items: { id: string; metadata?: Record<string, unknown> | null }[] }
  }>(`/store/carts/${encodeURIComponent(cartId)}`, { fields: "items.id,items.metadata" })
  const line = cart.items.find((item) => item.metadata?.[LINE_MARK] === mark)
  if (!line) {
    throw new Error("addons: the new line was not found in the cart")
  }
  try {
    await storePost(`${linePath(cartId, line.id)}/addons`, { selections })
  } catch (error) {
    await storeDelete(linePath(cartId, line.id)).catch(() => undefined)
    throw error
  }
}

/** A cart line's picks written again; none takes them off (the line goes back to the variant's price). */
export async function saveAddonLine(
  lineId: string,
  selections: readonly StoreAddonSelection[]
): Promise<void> {
  const cartId = await cartIdFromCookie()
  if (!cartId) {
    throw new Error("addons: no cart")
  }
  await storePost(`${linePath(cartId, lineId)}/addons`, { selections })
}
