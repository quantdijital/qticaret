import "server-only"
import { formatLira } from "@qticaret/ui"
import type { CheckoutSummaryView, ImageView, Translate } from "@qticaret/ui"
import { cartShips } from "@/lib/cart/ships"
import type { CheckoutCart } from "@/lib/checkout/cart"
import type { StoreCartBooking } from "@/lib/booking/store"
import { lineAddonsOf } from "./addons"
import { holdViewOf, lineBookingOf, withBookingRead } from "./booking"
import { lineNetOf, netDiscountOf, netTotalsOf, taxLinesOf } from "./cart-tax"
import { lineImageOf, linePathOf } from "./line-paths"

const kurus = (lira: number) => Math.round(lira * 100)

/** A dated line's departure (adr/0076 §10); nothing on any other line. */
const bookingOf = (lineId: string, metadata: unknown) => {
  const booking = lineBookingOf(lineId, metadata, null)
  return booking ? { booking } : {}
}

/**
 * The basket with its dated lines told by the cart's read (adr/0076 §10):
 * each line expired once its places are not held, the hold's countdown,
 * and a note when a shipping method is left on a cart that ships nothing
 * (Ek D3; the server is taking it off, Ek D5). Without the read: as it was.
 */
export function withBookingSummary(
  summary: CheckoutSummaryView,
  items: readonly { id: string; metadata?: Record<string, unknown> | null }[],
  booking: StoreCartBooking | null,
  t: Translate
): CheckoutSummaryView {
  const hold = holdViewOf(items, booking)
  if (!booking || !hold) {
    return summary
  }
  return {
    ...summary,
    lines: withBookingRead(summary.lines, items, booking),
    hold,
    ...(booking.shipping_method_stale ? { notice: t("booking.shipping_stale") } : {}),
  }
}

/**
 * The basket beside the checkout and the card form: each line with its
 * picks, its product's page (`productPathsOf`; none: plain text) and its
 * picture's versions (`linePicturesOf`), the backend's totals in words.
 * A wholesaler's (`vatExcluded`, ADR-0068 §5): lines and items without
 * KDV, the KDV a line of its own; the shipping and the total as they are.
 */
export function summaryOf(
  cart: CheckoutCart,
  t: Translate,
  paths: ReadonlyMap<string, string> = new Map(),
  pictures: ReadonlyMap<string, ImageView> = new Map(),
  vatExcluded = false
): CheckoutSummaryView {
  const net = vatExcluded ? netTotalsOf(cart) : null
  const discount = kurus(cart.original_item_total) - kurus(cart.item_total)
  return {
    lines: cart.items.map((line) => ({
      id: line.id,
      title: line.title,
      detail: line.variant_title ?? line.subtitle,
      quantity: line.quantity,
      total: formatLira(net ? lineNetOf(line) : line.total),
      image: lineImageOf(line.thumbnail, line.title, pictures),
      path: linePathOf(paths, line),
      addons: lineAddonsOf(line.metadata).addons,
      ...bookingOf(line.id, line.metadata),
    })),
    items: formatLira(cart.original_item_total),
    discount: net ? netDiscountOf(net) : discount > 0 ? formatLira(discount / 100) : null,
    credit: cart.credit_line_total ? formatLira(cart.credit_line_total) : null,
    shipping:
      cart.shipping_methods.length === 0
        ? null
        : cart.shipping_total > 0
          ? formatLira(cart.shipping_total)
          : t("checkout.free"),
    // Nothing to ship (adr/0076 §6): no shipping row; a shipped basket's view as it was
    ...(cartShips(cart.items) ? {} : { ships: false }),
    total: formatLira(cart.total),
    ...(net ? { tax: taxLinesOf(net, t("checkout.wholesale_note")) } : {}),
  }
}
