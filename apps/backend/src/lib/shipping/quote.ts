import { fromMedusaAmount, kurus, ZERO_KURUS } from "../money"
import type { Kurus, MedusaAmount } from "../money"

/**
 * One price for every shipping option the shop sells (adr/0087 §2): the
 * carrier table, Geliver's quote or a flat amount is only the base this
 * works from. Nothing here comes from a shopper: the context is laid over
 * Medusa's own by our hook (`workflows/hooks/shipping-quote-context.ts`),
 * which reads the basket and the shop's settings on the server.
 */

/** Where the hook puts what it read in a calculated price's context. */
export const QUOTE_CONTEXT_KEY = "qt_shipping"

/** What the hook read for a cart, in kuruş, KDV in. */
export interface ShippingQuoteContext {
  /** Free shipping from this basket total (Settings > Promotions); null: never. */
  threshold: Kurus | null
  /** The cart's lines after their discounts, KDV in (`item_total`, as adr/0024 counts it). */
  item_total: Kurus
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const kurusOrNull = (value: unknown): Kurus | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? kurus(value) : null

/**
 * The hook's reading from a provider's context; null when it is missing
 * or not in our shape. Without it nothing is free: the base is charged.
 */
export function quoteContextOf(context: unknown): ShippingQuoteContext | null {
  const read = isRecord(context) ? context[QUOTE_CONTEXT_KEY] : null
  if (!isRecord(read)) {
    return null
  }
  const itemTotal = kurusOrNull(read["item_total"])
  if (itemTotal === null) {
    return null
  }
  return { threshold: kurusOrNull(read["threshold"]), item_total: itemTotal }
}

/** A threshold set in lira (Settings > Promotions) in kuruş; null when off. */
export function thresholdKurus(lira: number | null | undefined): Kurus | null {
  if (typeof lira !== "number" || !Number.isFinite(lira) || lira <= 0) {
    return null
  }
  return fromMedusaAmount(lira, { allowRounding: true })
}

/** A Medusa amount (lira) in kuruş, never below zero; a missing one is zero. */
export function itemTotalKurus(value: MedusaAmount | null | undefined): Kurus {
  if (value === null || value === undefined) {
    return ZERO_KURUS
  }
  const amount = fromMedusaAmount(value, { allowRounding: true })
  return amount > 0 ? amount : ZERO_KURUS
}

/** Whether the basket reaches the threshold: exactly the threshold counts, as `gte` did. */
export const reachesThreshold = (context: ShippingQuoteContext | null): boolean =>
  context !== null && context.threshold !== null && context.item_total >= context.threshold

export interface ShippingQuoteInput<Line> {
  /** The lines the option ships (Medusa gives an option its own profile's lines). */
  lines: readonly Line[]
  /** The hook's reading; null when it did not run: the base is charged. */
  context: ShippingQuoteContext | null
  /** The option's own price for the lines: a flat amount, the table, Geliver's quote. */
  price: (lines: readonly Line[]) => Kurus | Promise<Kurus>
}

/**
 * What the shopper pays for the option, KDV in. A basket at or past the
 * threshold ships free with every option, carrier tables and Geliver too
 * (adr/0087 §2.5): the base is not even asked for.
 */
export async function shippingQuote<Line>(input: ShippingQuoteInput<Line>): Promise<Kurus> {
  if (reachesThreshold(input.context)) {
    return ZERO_KURUS
  }
  return input.price(input.lines)
}
