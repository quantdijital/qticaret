import "server-only"
import { formatLira } from "@qticaret/ui"
import type { CheckoutSummaryView, ImageView, Translate } from "@qticaret/ui"
import type { CheckoutCart } from "@/lib/checkout/cart"
import { lineAddonsOf } from "./addons"
import { lineNetOf, netDiscountOf, netTotalsOf, taxLinesOf } from "./cart-tax"
import { lineImageOf, linePathOf } from "./line-paths"

const kurus = (lira: number) => Math.round(lira * 100)

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
    total: formatLira(cart.total),
    ...(net ? { tax: taxLinesOf(net, t("checkout.wholesale_note")) } : {}),
  }
}
