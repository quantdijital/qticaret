import { formatLira } from "@qticaret/ui"
import type {
  CartLineView,
  CheckoutBlockedView,
  FreeShippingView,
  ImageView,
  MiniCartView,
  Translate,
} from "@qticaret/ui"
import type { StoreProductAddon } from "@qticaret/types"
import type { Cart } from "@/lib/cart/cart"
import type { GiftLine } from "@/lib/cart/gift"
import { cartShips } from "@/lib/cart/ships"
import { isPaymentLinkCart } from "@/lib/cart/payment-link"
import { addonFormOf, lineAddonsOf } from "./addons"
import { lineBookingOf } from "./booking"
import { lineNetOf, netTotalsOf } from "./cart-tax"
import { lineImageOf, linePathOf } from "./line-paths"

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
  t: Translate,
  allFree = false
): FreeShippingView | null {
  // adr/0087 §3: every product that travels ships free, whatever the total
  if (allFree && itemTotal > 0) {
    return { message: t("cart.free_shipping_products"), percent: 100, reached: true }
  }
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

/**
 * Whether every line that travels is of a free-shipping product (adr/0087
 * §3); false for a cart with none that travels.
 */
export function allShipFree(
  lines: readonly { product_id?: string | null; requires_shipping?: boolean | null }[],
  free: ReadonlySet<string>
): boolean {
  const shipped = lines.filter((line) => line.requires_shipping !== false)
  return shipped.length > 0 && shipped.every((line) => free.has(line.product_id ?? ""))
}

/**
 * In a mixed cart, "Ücretsiz kargo" under each free-shipping product's line
 * (adr/0087 §3); none when the whole cart ships free (the meter says it).
 */
export function withShippingNotes(
  views: CartLineView[],
  cart: Cart | null,
  free: ReadonlySet<string>,
  t: Translate
): CartLineView[] {
  const items = cart?.items ?? []
  if (free.size === 0 || allShipFree(items, free)) {
    return views
  }
  const byLine = new Map(items.map((line) => [line.id, line]))
  return views.map((view) => {
    const item = byLine.get(view.id)
    return item && item.requires_shipping !== false && free.has(item.product_id ?? "")
      ? { ...view, shippingNote: t("cart.line_free_shipping") }
      : view
  })
}

/** Discounts in kuruş are compared rounded: no "−0,00 TL" from float noise. */
export const differs = (a: number, b: number) => kurus(a) !== kurus(b)

/**
 * The cart's lines as the cart page and the drawer show them, each with its
 * add-on picks (adr/0052), its product's page (`productPathsOf`) and its
 * picture's versions (`linePicturesOf`). `taxNote`: a wholesaler's lines
 * (ADR-0068 §5), each total without its KDV, said so, never struck through.
 */
export function cartLinesOf(
  cart: Cart | null,
  paths: ReadonlyMap<string, string> = new Map(),
  pictures: ReadonlyMap<string, ImageView> = new Map(),
  taxNote: string | null = null
): CartLineView[] {
  return (cart?.items ?? []).map((line) => {
    // A dated line's departure (adr/0076 §10); its hold is read on the cart page only
    const booking = lineBookingOf(line.id, line.metadata, null)
    return {
      ...lineAddonsOf(line.metadata),
      id: line.id,
      title: line.title,
      detail: line.variant_title ?? line.subtitle,
      quantity: line.quantity,
      total: formatLira(taxNote ? lineNetOf(line) : line.total),
      // Before the promotions' adjustments only: a price list's sale is already the unit price,
      // so the theme reads it as "Promosyon indirimi", never as a price before (adr/0076 Ek 2026-11-25)
      original:
        !taxNote && differs(line.original_total, line.total)
          ? formatLira(line.original_total)
          : null,
      ...(taxNote ? { taxNote } : {}),
      image: lineImageOf(line.thumbnail, line.title, pictures),
      path: linePathOf(paths, line),
      ...(booking ? { booking } : {}),
    }
  })
}

/**
 * The header drawer's cart; null without lines. A wholesaler's
 * (`vatExcluded`, ADR-0068 §5): lines and subtotal without KDV, said so;
 * free shipping still measured on the KDV-included amount, as the
 * backend's rule reads it. `checkoutBlocked`: why the cart cannot go to
 * the payment yet, as the cart page says it (`wholesaleCheckoutBlocked`).
 * `shipping`: the server's estimate in words (`drawerShippingOf`).
 */
export function miniCartOf(
  cart: Cart | null,
  threshold: number | null,
  t: Translate,
  paths: ReadonlyMap<string, string> = new Map(),
  pictures: ReadonlyMap<string, ImageView> = new Map(),
  vatExcluded = false,
  checkoutBlocked: CheckoutBlockedView | null = null,
  freeProducts: ReadonlySet<string> = new Set(),
  shipping: string | null = null
): MiniCartView | null {
  if (!cart || cart.items.length === 0) {
    return null
  }
  const net = vatExcluded ? netTotalsOf(cart) : null
  const ships = cartShips(cart.items)
  return {
    lines: cartLinesOf(cart, paths, pictures, net ? t("cart.line_vat_excluded") : null),
    subtotal: formatLira(net ? net.net / 100 : cart.item_total),
    // Nothing to ship (adr/0076 §6): no free shipping meter, no word of shipping
    freeShipping: ships
      ? freeShippingOf(cart.item_total, threshold, t, allShipFree(cart.items, freeProducts))
      : null,
    ...(ships ? {} : { note: t("cart.drawer_note_unshipped") }),
    // The server's figure for its main option: a row, and the note no longer says checkout prices it
    ...(ships && shipping ? { shipping, note: t("cart.drawer_note_shipping_known") } : {}),
    locked: lockedNoteOf(cart, t),
    ...(net ? { taxNote: t("cart.drawer_wholesale_note") } : {}),
    ...(checkoutBlocked ? { checkoutBlocked } : {}),
  }
}

/** A payment link's cart (adr/0051): the note that its lines are fixed; null for any other cart. */
export const lockedNoteOf = (cart: Cart | null, t: Translate): string | null =>
  cart && isPaymentLinkCart(cart.metadata) ? t("cart.payment_link_note") : null

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
