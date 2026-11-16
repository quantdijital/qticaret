import { fromMedusaAmount } from "../money"
import type { Kurus, MedusaAmount } from "../money"

/**
 * A wholesaler's cart at the payment (ADR-0068 §6, §7, §8, slice 4): the
 * pure rules; reading the cart and Medusa's prices is the workflows'.
 */

/** A cart line as these rules read it. */
export interface WholesaleCartLine {
  id: string
  variant_id?: string | null
  quantity: MedusaAmount
  unit_price: MedusaAmount
  /** Add-on lines (adr/0052) and the fee of paying at the door: priced by their own rules. */
  is_custom_price?: boolean | null
}

const linesOf = <T>(lines: readonly (T | null | undefined)[] | null | undefined): T[] =>
  (lines ?? []).flatMap((line) => (line ? [line] : []))

/**
 * The units an order counts toward its minimum (§8): the product lines'
 * quantities. A line without a variant (the fee of paying at the door) is
 * no product; add-on picks and gift wrapping ride on their product's line.
 */
export function orderUnits(
  lines: readonly (WholesaleCartLine | null | undefined)[] | null
): number {
  return linesOf(lines).reduce(
    (sum, line) => (line.variant_id ? sum + Number(line.quantity) : sum),
    0
  )
}

/** The order is short of the wholesaler's minimum (§8); no minimum, never short. */
export const isShortOfMinimum = (minQuantity: number | null, units: number): boolean =>
  minQuantity !== null && minQuantity > 0 && units < minQuantity

/**
 * The lines whose unit price is not the one Medusa gives the cart's
 * customer now (§7): a level or own list changed, the wholesaler closed
 * or removed, the flag turned, since the line was priced. Lines priced by
 * their own rules (`is_custom_price`) and lines with no price now (left to
 * Medusa's own checks) are not judged here.
 */
export function stalePriceLines(
  lines: readonly (WholesaleCartLine | null | undefined)[] | null,
  now: ReadonlyMap<string, Kurus>
): string[] {
  return linesOf(lines).flatMap((line) => {
    if (line.is_custom_price === true || !line.variant_id) {
      return []
    }
    const price = now.get(line.id)
    if (price === undefined) {
      return []
    }
    return fromMedusaAmount(line.unit_price, { allowRounding: true }) === price ? [] : [line.id]
  })
}

interface Adjusted {
  id: string
  adjustments?: unknown[] | null
}

/**
 * What a wholesaler's cart gives Medusa's promotion rules in place of its
 * lines and shipping (§6: no campaign is theirs, no code either). Each
 * line and method keeps its id and its adjustments, so Medusa takes the
 * old ones off (2.21.2 `computeActions` removes every adjustment it is
 * shown), but carries nothing a promotion can apply to: a line is not
 * discountable and costs nothing, a method costs nothing, and neither
 * carries a product, a variant or an option a rule could match.
 */
export function promotionShells(cart: {
  items?: readonly (Adjusted | null | undefined)[] | null
  shipping_methods?: readonly (Adjusted | null | undefined)[] | null
}): { items: Record<string, unknown>[]; shipping_methods: Record<string, unknown>[] } {
  return {
    items: linesOf(cart.items).map((item) => ({
      id: item.id,
      quantity: 0,
      subtotal: 0,
      original_total: 0,
      is_discountable: false,
      adjustments: item.adjustments ?? [],
    })),
    shipping_methods: linesOf(cart.shipping_methods).map((method) => ({
      id: method.id,
      subtotal: 0,
      original_total: 0,
      adjustments: method.adjustments ?? [],
    })),
  }
}
