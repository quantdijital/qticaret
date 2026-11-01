import "server-only"
import { isNotFound, isStoreApiError } from "../store-api/errors"
import { liraRegion } from "../store-api/requests"
import { storeDelete, storeGet, storePost } from "../store-api/server"
import { cartIdFromCookie, forgetCart, rememberCart } from "./cookie"

export interface CartLine {
  id: string
  title: string
  subtitle: string | null
  variant_title: string | null
  thumbnail: string | null
  quantity: number
  unit_price: number
  total: number
  /** Before discounts, KDV included. */
  original_total: number
}

export interface Cart {
  id: string
  currency_code: string
  /** Items before discounts and after, KDV included (Medusa's cart totals). */
  original_item_total: number
  item_total: number
  total: number
  completed_at: string | null
  items: CartLine[]
}

const CART_FIELDS = [
  "id",
  "currency_code",
  "original_item_total",
  "item_total",
  "total",
  "completed_at",
  "items.id",
  "items.title",
  "items.subtitle",
  "items.variant_title",
  "items.thumbnail",
  "items.quantity",
  "items.unit_price",
  "items.total",
  "items.original_total",
].join(",")

/** The shopper's open cart, or null (none yet, gone, or already ordered). */
export async function currentCart(): Promise<Cart | null> {
  const id = await cartIdFromCookie()
  if (!id) {
    return null
  }
  try {
    const { cart } = await storeGet<{ cart: Cart }>(`/store/carts/${id}`, { fields: CART_FIELDS })
    return cart.completed_at ? null : cart
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
}

/** How many items the header shows; a backend hiccup shows none rather than failing the page. */
export async function cartQuantity(): Promise<number> {
  try {
    const cart = await currentCart()
    return (cart?.items ?? []).reduce((sum, line) => sum + line.quantity, 0)
  } catch (error) {
    if (isStoreApiError(error)) {
      return 0
    }
    throw error
  }
}

async function newCart(): Promise<string> {
  const { id: region_id } = await liraRegion()
  const { cart } = await storePost<{ cart: { id: string } }>("/store/carts", { region_id })
  await rememberCart(cart.id)
  return cart.id
}

/**
 * Puts a variant in the shopper's cart, opening a cart when there is none
 * or the remembered one is gone or ordered. Prices come from the backend
 * (CLAUDE.md rule 5): only the variant and the quantity are sent.
 */
export async function addLine(variantId: string, quantity: number): Promise<void> {
  const existing = await currentCart().catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  })
  const cartId = existing?.id ?? (await newCart())
  try {
    await storePost(`/store/carts/${cartId}/line-items`, { variant_id: variantId, quantity })
  } catch (error) {
    if (!existing || !isNotFound(error)) {
      throw error
    }
    await forgetCart()
    await storePost(`/store/carts/${await newCart()}/line-items`, {
      variant_id: variantId,
      quantity,
    })
  }
}

/**
 * Sets a line's quantity in the shopper's own cart; zero removes it. The
 * line must be in the cart the cookie names (Medusa refuses another's).
 */
export async function changeLine(lineId: string, quantity: number): Promise<void> {
  const cartId = await cartIdFromCookie()
  if (!cartId) {
    return
  }
  const line = `/store/carts/${cartId}/line-items/${encodeURIComponent(lineId)}`
  if (quantity === 0) {
    await storeDelete(line)
  } else {
    await storePost(line, { quantity })
  }
}
