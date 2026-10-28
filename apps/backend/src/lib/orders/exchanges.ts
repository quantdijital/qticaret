import type { ReturnLine } from "./returns"

/**
 * An exchange (F7.11, adr/0032 §6): each line sent back for another
 * variant of the same product, as many as are sent back. Prices are
 * never the shopper's: what the swap costs is the new variant's price
 * today less the line's price at purchase (Medusa's own exchange sums,
 * where a returned unit counts at its unit price), so a size swap at the
 * same price costs nothing, a coupon included. Pure, so tested on its own.
 */

export interface ExchangeLine extends ReturnLine {
  /** The variant the shopper wants instead. */
  variant_id: string
}

export interface ExchangeOrderLine {
  id: string
  product_id: string | null
  variant_id: string | null
  /** Kuruş, KDV included, as the order sold it. */
  unit_price: number
}

export interface ExchangeVariant {
  id: string
  product_id: string
  /** Kuruş, KDV included, the shop's price today; null when not for sale. */
  price: number | null
  /** Units that can be promised: in stock, or unlimited (not managed, or backorder). */
  available: number
}

/** Why the swap cannot be asked for (an i18n key); null when it can. */
export function exchangeProblem(
  lines: ReadonlyMap<string, ExchangeOrderLine>,
  variants: ReadonlyMap<string, ExchangeVariant>,
  wanted: readonly ExchangeLine[]
): string | null {
  const needed = new Map<string, number>()
  for (const line of wanted) {
    needed.set(line.variant_id, (needed.get(line.variant_id) ?? 0) + line.quantity)
  }
  for (const line of wanted) {
    const sold = lines.get(line.line_item_id)
    const variant = variants.get(line.variant_id)
    if (!sold || variant?.product_id !== sold.product_id) {
      return "returns.exchange_variant_invalid"
    }
    if (variant.id === sold.variant_id) {
      return "returns.exchange_same_variant"
    }
    if (variant.price === null) {
      return "returns.exchange_variant_invalid"
    }
    if ((needed.get(variant.id) ?? 0) > variant.available) {
      return "returns.exchange_out_of_stock"
    }
  }
  return null
}

/**
 * What the swap costs the shopper, in kuruş: positive when they owe the
 * shop, negative when the shop owes them.
 */
export function exchangeDifference(
  lines: ReadonlyMap<string, ExchangeOrderLine>,
  variants: ReadonlyMap<string, ExchangeVariant>,
  wanted: readonly ExchangeLine[]
): number {
  return wanted.reduce((sum, line) => {
    const sold = lines.get(line.line_item_id)?.unit_price ?? 0
    const today = variants.get(line.variant_id)?.price ?? 0
    return sum + (today - sold) * line.quantity
  }, 0)
}
