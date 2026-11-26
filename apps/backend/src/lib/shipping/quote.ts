import { fromMedusaAmount, kurus, ZERO_KURUS } from "../money"
import type { Kurus, MedusaAmount } from "../money"

/**
 * One price for every shipping option the shop sells (adr/0087 §2): the
 * carrier table or a flat amount is only the base this
 * works from. Nothing here comes from a shopper: the context is laid over
 * Medusa's own by our hook (`workflows/hooks/shipping-quote-context.ts`),
 * which reads the basket, its products' shipping classes and the shop's
 * settings on the server.
 */

/** Where the hook puts what it read in a calculated price's context. */
export const QUOTE_CONTEXT_KEY = "qt_shipping"

/** The built-in class: the product ships free (adr/0087 §1); never renamed, never removed. */
export const FREE_SHIPPING_CLASS = "free"

/** What the hook read for a cart, in kuruş, KDV in. */
export interface ShippingQuoteContext {
  /** Free shipping from this basket total (Settings > Promotions); null: never. */
  threshold: Kurus | null
  /** The cart's lines after their discounts, KDV in (`item_total`, as adr/0024 counts it). */
  item_total: Kurus
  /** Each product's class in the cart; a product without one is Standard. */
  classes?: Readonly<Record<string, string>>
  /** Each of the shop's own classes' surcharge (Settings > Shipping). */
  surcharges?: Readonly<Record<string, Kurus>>
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const kurusOrNull = (value: unknown): Kurus | null =>
  typeof value === "number" && Number.isSafeInteger(value) && value >= 0 ? kurus(value) : null

const stringsOf = (value: unknown): Record<string, string> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).filter(
          (entry): entry is [string, string] => typeof entry[1] === "string"
        )
      )
    : {}

const amountsOf = (value: unknown): Record<string, Kurus> =>
  isRecord(value)
    ? Object.fromEntries(
        Object.entries(value).flatMap(([key, amount]) => {
          const read = kurusOrNull(amount)
          return read === null ? [] : [[key, read]]
        })
      )
    : {}

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
  return {
    threshold: kurusOrNull(read["threshold"]),
    item_total: itemTotal,
    classes: stringsOf(read["classes"]),
    surcharges: amountsOf(read["surcharges"]),
  }
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

/** A cart line as the quote reads it: whose product it is, whether it travels. */
export interface QuoteLine {
  product_id?: string | null
  requires_shipping?: boolean | null
  variant?: {
    product?: { id?: string | null } | null
    product_id?: string | null
  } | null
}

/** The product a line is of; empty when it does not say. */
export const productOfLine = (line: QuoteLine): string =>
  line.product_id ?? line.variant?.product?.id ?? line.variant?.product_id ?? ""

/**
 * A map's own value for a key: never one an object inherits (`constructor`
 * is a valid class key; security review 2026-11-26).
 */
function ownValue<T>(map: Readonly<Record<string, T>> | undefined, key: string): T | null {
  return map && Object.hasOwn(map, key) ? (map[key] ?? null) : null
}

/** How the option's base price is made: once per order, or from the parcel of the lines. */
export type QuoteBasis = "order" | "parcel"

export interface ShippingQuoteInput<Line extends QuoteLine> {
  /** The lines the option ships (Medusa gives an option its own profile's lines). */
  lines: readonly Line[]
  /** The hook's reading; null when it did not run: the base is charged. */
  context: ShippingQuoteContext | null
  /** A flat amount is per order; a table prices the parcel. */
  basis: QuoteBasis
  /** The option's own price for the lines: a flat amount or the table. */
  price: (lines: readonly Line[]) => Kurus | Promise<Kurus>
}

/**
 * What the shopper pays for the option, KDV in (adr/0087 §2):
 * - a basket at or past the threshold ships free with every option (§2.5);
 * - every line that travels in the free class: free, whatever the option;
 * - otherwise the base: a flat amount in full (it is per order), or the
 *   parcel of the paid lines alone (a free product's desi adds nothing);
 * - plus the highest surcharge among the paid lines' classes, once (§2.4).
 * A class the shop no longer has counts as Standard. The base is not
 * asked for when the answer is free.
 */
export async function shippingQuote<Line extends QuoteLine>(
  input: ShippingQuoteInput<Line>
): Promise<Kurus> {
  const { context } = input
  if (reachesThreshold(context)) {
    return ZERO_KURUS
  }
  const classOf = (line: Line) => ownValue(context?.classes, productOfLine(line))
  const shipped = input.lines.filter((line) => line.requires_shipping !== false)
  const paid = shipped.filter((line) => classOf(line) !== FREE_SHIPPING_CLASS)
  if (shipped.length > 0 && paid.length === 0) {
    return ZERO_KURUS
  }
  const base = await input.price(input.basis === "order" || paid.length === 0 ? input.lines : paid)
  const surcharge = Math.max(
    0,
    ...paid.map((line) => {
      const key = classOf(line)
      return key ? (ownValue(context?.surcharges, key) ?? 0) : 0
    })
  )
  return kurus(base + surcharge)
}
