import { formatLira } from "@qticaret/ui"
import type { CartLineView, FreeShippingView, MiniCartView, Translate } from "@qticaret/ui"
import type { StoreProductAddon } from "@qticaret/types"
import type { Cart } from "@/lib/cart/cart"
import type { GiftLine } from "@/lib/cart/gift"
import { addonFormOf, lineAddonsOf } from "./addons"

/** Kuruş, so float noise never says "0,00 TL more". */
const kurus = (lira: number): number => Math.round(lira * 100)

/**
 * How near the cart is to free shipping (F4.5): the same amount the
 * backend's rule reads (`item_total`, KDV in, after discounts). Null when
 * the shop gives no free shipping or the cart is empty.
 */
export function freeShippingOf(
  itemTotal: number,
  threshold: number | null,
  t: Translate
): FreeShippingView | null {
  if (threshold === null || threshold <= 0 || itemTotal <= 0) {
    return null
  }
  const left = kurus(threshold) - kurus(itemTotal)
  if (left <= 0) {
    return { message: t("cart.free_shipping_reached"), percent: 100, reached: true }
  }
  return {
    message: t("cart.free_shipping_left", { amount: formatLira(left / 100) }),
    percent: Math.floor((kurus(itemTotal) / kurus(threshold)) * 100),
    reached: false,
  }
}

/** Discounts in kuruş are compared rounded: no "−0,00 TL" from float noise. */
export const differs = (a: number, b: number) => kurus(a) !== kurus(b)

/** The cart's lines as the cart page and the drawer show them, each with its add-on picks (adr/0052). */
export function cartLinesOf(cart: Cart | null): CartLineView[] {
  return (cart?.items ?? []).map((line) => ({
    ...lineAddonsOf(line.metadata),
    id: line.id,
    title: line.title,
    detail: line.variant_title ?? line.subtitle,
    quantity: line.quantity,
    total: formatLira(line.total),
    original: differs(line.original_total, line.total) ? formatLira(line.original_total) : null,
    image: line.thumbnail
      ? {
          src: line.thumbnail,
          alt: line.title,
          width: null,
          height: null,
          sources: { avif: null, webp: null },
        }
      : null,
  }))
}

/** The header drawer's cart; null without lines. */
export function miniCartOf(
  cart: Cart | null,
  threshold: number | null,
  t: Translate
): MiniCartView | null {
  if (!cart || cart.items.length === 0) {
    return null
  }
  return {
    lines: cartLinesOf(cart),
    subtotal: formatLira(cart.item_total),
    freeShipping: freeShippingOf(cart.item_total, threshold, t),
  }
}

/** The cart's gift card lines with their recipients (adr/0025 Ek 2026-11-03), as typed. */
export function withGiftLines(lines: CartLineView[], gifts: readonly GiftLine[]): CartLineView[] {
  const byLine = new Map(gifts.map((gift) => [gift.line_id, gift.recipient]))
  return lines.map((line) => {
    if (!byLine.has(line.id)) {
      return line
    }
    const recipient = byLine.get(line.id) ?? null
    return {
      ...line,
      gift: {
        recipient: recipient
          ? {
              email: recipient.recipient_email,
              name: recipient.recipient_name,
              message: recipient.message,
              sender: recipient.sender_name,
            }
          : null,
      },
    }
  })
}

/**
 * The picks form under each line of a product with add-ons (adr/0052):
 * filled with the line's picks, or empty on a line bought without them.
 * `addons` holds only the products that have add-ons now.
 */
export function withAddonForms(
  lines: CartLineView[],
  cart: Cart | null,
  addons: ReadonlyMap<string, readonly StoreProductAddon[]>,
  t: Translate
): CartLineView[] {
  const byLine = new Map((cart?.items ?? []).map((line) => [line.id, line]))
  return lines.map((line) => {
    const item = byLine.get(line.id)
    const productId = item?.product_id
    const offered = productId ? addons.get(productId) : undefined
    const form = productId && offered ? addonFormOf(productId, offered, item.metadata, t) : null
    return form ? { ...line, addonForm: form } : line
  })
}
