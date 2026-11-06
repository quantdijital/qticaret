import "server-only"
import { isNotFound, isStoreApiError } from "../store-api/errors"
import { liraRegion, storefrontSettings } from "../store-api/requests"
import { storeDelete, storeGet, storePost } from "../store-api/server"
import { cookies } from "next/headers"
import { cookieName } from "../security/cookies"
import { cartIdFromCookie, forgetCart, rememberCart } from "./cookie"
import { LANDING_COOKIE, readLanding } from "./landing"

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
  product_id?: string | null
  /** The line's variant, for its price display's cart offer (adr/0046 Ek 2026-11-05). */
  variant_id?: string | null
  /** The server's records on the line: its add-on picks (`qt_addons`, adr/0052) among them. */
  metadata?: Record<string, unknown> | null
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
  /** The codes on the cart (automatic campaigns have none to show). */
  promotions: { code: string | null; is_automatic?: boolean | null }[]
  /** What gift cards and store credit take off (F4.8), KDV included. */
  credit_line_total?: number | null
  /** The gift cards on the cart; asked only while the shop has them on. */
  gift_cards?: { code: string }[] | null
  /** The server's records on the cart: a payment link's mark (`qt_payment_link`, adr/0051). */
  metadata?: Record<string, unknown> | null
  /** The shipping chosen at checkout, if any: priced again when a code comes or goes. */
  shipping_methods?: { shipping_option_id: string | null }[] | null
}

const CART_FIELDS = [
  "id",
  "currency_code",
  "original_item_total",
  "item_total",
  "total",
  "completed_at",
  "metadata",
  "items.id",
  "items.title",
  "items.subtitle",
  "items.variant_title",
  "items.thumbnail",
  "items.quantity",
  "items.unit_price",
  "items.total",
  "items.original_total",
  "items.product_id",
  "items.variant_id",
  "items.metadata",
  "promotions.code",
  "promotions.is_automatic",
  "credit_line_total",
  "shipping_methods.shipping_option_id",
].join(",")

// Asked only while gift cards are on: the backend refuses the relation otherwise (adr/0025)
const GIFT_CARD_FIELDS = ",gift_cards.code"

/**
 * The cart with its gift cards while the shop has them on. The flag is read
 * from a cache up to a minute old: a cart asked with the gift card fields
 * just after the shop turned them off is refused (400), and asked again
 * without them.
 */
async function readCart(id: string, giftCards: boolean): Promise<Cart> {
  if (giftCards) {
    try {
      return (
        await storeGet<{ cart: Cart }>(`/store/carts/${id}`, {
          fields: CART_FIELDS + GIFT_CARD_FIELDS,
        })
      ).cart
    } catch (error) {
      if (!isStoreApiError(error) || error.status !== 400) {
        throw error
      }
    }
  }
  return (await storeGet<{ cart: Cart }>(`/store/carts/${id}`, { fields: CART_FIELDS })).cart
}

/** The shopper's open cart, or null (none yet, gone, or already ordered). */
export async function currentCart(): Promise<Cart | null> {
  const id = await cartIdFromCookie()
  if (!id) {
    return null
  }
  try {
    const { features } = await storefrontSettings()
    const cart = await readCart(id, features?.gift_cards === true)
    return cart.completed_at ? null : cart
  } catch (error) {
    if (isNotFound(error)) {
      return null
    }
    throw error
  }
}

/** The cart for the header (count and drawer); a backend hiccup shows none rather than failing the page. */
export async function headerCart(): Promise<Cart | null> {
  try {
    return await currentCart()
  } catch (error) {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  }
}

async function newCart(): Promise<string> {
  const { id: region_id } = await liraRegion()
  const { cart } = await storePost<{ cart: { id: string } }>("/store/carts", { region_id })
  await rememberCart(cart.id)
  // Where the visit came from goes with its first cart (F11.2); a refusal costs the cart nothing
  const landing = readLanding((await cookies()).get(cookieName(LANDING_COOKIE))?.value)
  if (landing) {
    await storePost(`/store/carts/${cart.id}/source`, landing).catch(() => undefined)
  }
  return cart.id
}

/**
 * Puts a variant in the shopper's cart, opening a cart when there is none
 * or the remembered one is gone or ordered. Prices come from the backend
 * (CLAUDE.md rule 5): only the variant, the quantity and, for a line of
 * its own, a mark of ours (never `qt_`) are sent. Answers the cart's id.
 */
export async function addLine(
  variantId: string,
  quantity: number,
  metadata?: Record<string, string>
): Promise<string> {
  const line = { variant_id: variantId, quantity, ...(metadata ? { metadata } : {}) }
  const existing = await currentCart().catch((error: unknown) => {
    if (isStoreApiError(error)) {
      return null
    }
    throw error
  })
  const cartId = existing?.id ?? (await newCart())
  try {
    await storePost(`/store/carts/${cartId}/line-items`, line)
    return cartId
  } catch (error) {
    if (!existing || !isNotFound(error)) {
      throw error
    }
    await forgetCart()
    const fresh = await newCart()
    await storePost(`/store/carts/${fresh}/line-items`, line)
    return fresh
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

/** The codes a shopper typed, as the cart holds them (automatic campaigns left out). */
export const codesOf = (cart: { promotions?: Cart["promotions"] | null } | null): string[] =>
  (cart?.promotions ?? []).flatMap((promotion) =>
    promotion.code && !promotion.is_automatic ? [promotion.code] : []
  )

/**
 * The shipping already chosen, priced again for the cart as it is now
 * (F4.5): Medusa re-prices shipping when the items change, not when a
 * code comes or goes, so a code that takes the basket under the free
 * shipping threshold would leave its 0 TL method behind. Each option is
 * chosen again (Medusa replaces the method). Best effort: the backend
 * still stops an order whose shipping went stale (`cart.shipping_changed`).
 */
async function repriceShipping(cart: Cart | null): Promise<void> {
  if (!cart) {
    return
  }
  const options = new Set(
    (cart.shipping_methods ?? []).flatMap((method) =>
      method.shipping_option_id ? [method.shipping_option_id] : []
    )
  )
  for (const option_id of options) {
    try {
      await storePost(`/store/carts/${cart.id}/shipping-methods`, { option_id })
    } catch (error) {
      if (!isStoreApiError(error)) {
        throw error
      }
    }
  }
}

/**
 * Puts a coupon code on the shopper's cart. Medusa answers the cart; a
 * code it did not take (unknown, expired, not for this cart) is not on it.
 */
export async function addPromotion(code: string): Promise<boolean> {
  const cartId = await cartIdFromCookie()
  if (!cartId) {
    return false
  }
  await storePost(`/store/carts/${cartId}/promotions`, { promo_codes: [code] })
  const cart = await currentCart()
  const taken = codesOf(cart).some((each) => each.toLowerCase() === code.toLowerCase())
  if (taken) {
    await repriceShipping(cart)
  }
  return taken
}

/** Puts a gift card on the cart (F4.8); whether it took is read back from the cart. */
export async function addGiftCard(code: string): Promise<boolean> {
  const cartId = await cartIdFromCookie()
  if (!cartId) {
    return false
  }
  await storePost(`/store/carts/${cartId}/gift-cards`, { code })
  const cart = await currentCart()
  return (cart?.gift_cards ?? []).some((card) => card.code.toUpperCase() === code.toUpperCase())
}

export async function removeGiftCard(code: string): Promise<void> {
  const cartId = await cartIdFromCookie()
  if (cartId) {
    await storeDelete(`/store/carts/${cartId}/gift-cards`, { code })
  }
}

/** Takes a code off the shopper's cart, the shipping priced again without it. */
export async function removePromotion(code: string): Promise<void> {
  const cartId = await cartIdFromCookie()
  if (cartId) {
    await storeDelete(`/store/carts/${cartId}/promotions`, { promo_codes: [code] })
    await repriceShipping(await currentCart())
  }
}
