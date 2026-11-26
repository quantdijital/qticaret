import { MedusaError } from "@medusajs/framework/utils"
import { BPS_PER_WHOLE, multiplyByRateBps, toMedusaAmount } from "../../../lib/money"
import type { Kurus } from "../../../lib/money"

/**
 * A variant's own sale price (adr/0086): a Medusa `sale` price list of its
 * own, marked as ours, with the sale's days on the list. Medusa's pricing
 * then sells at it (the cart too) while it runs and at the variant's own
 * price before and after; the price-before rule (adr/0023) decides what
 * is struck through, as for any other list.
 */
export const VARIANT_SALE = "variant_sale"

/** What marks a list as one variant's sale price (adr/0037 §6's way). */
// A record, as Medusa takes metadata
export interface VariantSaleMeta extends Record<string, unknown> {
  managed_by: typeof VARIANT_SALE
  variant_id: string
}

export const isVariantSaleMeta = (meta: unknown): meta is VariantSaleMeta =>
  typeof meta === "object" &&
  meta !== null &&
  (meta as { managed_by?: unknown }).managed_by === VARIANT_SALE &&
  typeof (meta as { variant_id?: unknown }).variant_id === "string"

/** A sale asked for: a price, or a share off the variant's own price (worked out here). */
export interface SaleEntry {
  variant_id: string
  amount?: Kurus | null
  rate_bps?: number | null
  starts_at?: string | null
  ends_at?: string | null
}

export interface VariantSaleInput {
  product_id: string
  set: SaleEntry[]
  clear: string[]
}

/** A variant's sale as it stands. */
export interface ExistingSale {
  price_list_id: string
  variant_id: string
  amount: Kurus
  starts_at: string | null
  ends_at: string | null
}

export interface SaleVariant {
  id: string
  title: string | null
  /** Its own price in the shop's currency, outside any list; null when it has none. */
  base: Kurus | null
}

export interface SaleContext {
  currency: string
  product_title: string
  variants: readonly SaleVariant[]
  existing: ReadonlyMap<string, readonly ExistingSale[]>
  now: Date
}

export interface NewSaleList {
  title: string
  description: string
  /** No type: Medusa's create takes none and makes a `sale` list, the kind that never sells above the variant's own price. */
  status: "active"
  starts_at: string | null
  ends_at: string | null
  metadata: VariantSaleMeta
  prices: { variant_id: string; currency_code: string; amount: number }[]
}

export interface VariantSalePlan {
  create: NewSaleList[]
  /** Lists replaced or cleared: deleted once the new ones are in. */
  remove: string[]
  /** Variants whose sale is already as asked: nothing written. */
  unchanged: string[]
}

const invalid = (code: string) => new MedusaError(MedusaError.Types.INVALID_DATA, code)

const instant = (value: string | null | undefined): number | null => {
  if (value === null || value === undefined) {
    return null
  }
  const at = new Date(value).getTime()
  if (Number.isNaN(at)) {
    throw invalid("variant_sale.date")
  }
  return at
}

const iso = (at: number | null) => (at === null ? null : new Date(at).toISOString())

const sameInstant = (a: string | null, b: string | null) => instant(a) === instant(b)

function saleAmount(entry: SaleEntry, base: Kurus): Kurus {
  const rate = entry.rate_bps ?? null
  const amount = entry.amount ?? null
  if (amount !== null && rate === null) {
    return amount
  }
  if (rate === null || amount !== null) {
    throw invalid("variant_sale.amount_or_rate")
  }
  if (!Number.isInteger(rate) || rate <= 0 || rate >= BPS_PER_WHOLE) {
    throw invalid("price_lists.rate")
  }
  return multiplyByRateBps(base, BPS_PER_WHOLE - rate)
}

function checkDistinct(input: VariantSaleInput) {
  const named = [...input.set.map((entry) => entry.variant_id), ...input.clear]
  if (new Set(named).size !== named.length) {
    throw invalid("variant_sale.duplicate")
  }
}

/**
 * What to write for a product's variants' sale prices: a new list for
 * each sale set (or changed), the old ones removed after; a sale cleared
 * removes its lists. A sale must be below the variant's own price (an
 * equal or higher one is no sale and Medusa would not sell at it), above
 * zero, and its days in order and not over already.
 */
export function planVariantSales(input: VariantSaleInput, context: SaleContext): VariantSalePlan {
  checkDistinct(input)
  const variants = new Map(context.variants.map((variant) => [variant.id, variant]))
  const plan: VariantSalePlan = { create: [], remove: [], unchanged: [] }
  const listsOf = (variantId: string) => context.existing.get(variantId) ?? []
  for (const variantId of input.clear) {
    if (!variants.has(variantId)) {
      throw invalid("variant_sale.variant_unknown")
    }
    plan.remove.push(...listsOf(variantId).map((sale) => sale.price_list_id))
  }
  for (const entry of input.set) {
    const variant = variants.get(entry.variant_id)
    if (!variant) {
      throw invalid("variant_sale.variant_unknown")
    }
    if (variant.base === null) {
      throw invalid("variant_sale.no_regular_price")
    }
    const amount = saleAmount(entry, variant.base)
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      throw invalid("variant_sale.amount")
    }
    if (amount >= variant.base) {
      throw invalid("variant_sale.not_below_regular")
    }
    const starts = instant(entry.starts_at)
    const ends = instant(entry.ends_at)
    if (starts !== null && ends !== null && ends <= starts) {
      throw invalid("variant_sale.dates_order")
    }
    if (ends !== null && ends <= context.now.getTime()) {
      throw invalid("variant_sale.ended")
    }
    const lists = listsOf(variant.id)
    const only = lists.length === 1 ? lists[0] : undefined
    if (
      only?.amount === amount &&
      sameInstant(only.starts_at, iso(starts)) &&
      sameInstant(only.ends_at, iso(ends))
    ) {
      plan.unchanged.push(variant.id)
      continue
    }
    plan.remove.push(...lists.map((sale) => sale.price_list_id))
    plan.create.push({
      title: [context.product_title, variant.title].filter(Boolean).join(" · "),
      description: "",
      status: "active",
      starts_at: iso(starts),
      ends_at: iso(ends),
      metadata: { managed_by: VARIANT_SALE, variant_id: variant.id },
      prices: [
        {
          variant_id: variant.id,
          currency_code: context.currency,
          amount: Number(toMedusaAmount(amount)),
        },
      ],
    })
  }
  return plan
}

/**
 * The sale the panel shows for a variant: the one running now, else the
 * next to come; an ended one is none (the panel shows no sale for it).
 */
export function shownSale(
  sales: readonly ExistingSale[],
  now: Date
): (ExistingSale & { running: boolean }) | null {
  const at = now.getTime()
  const live = sales.filter((sale) => (instant(sale.ends_at) ?? Infinity) > at)
  const running = live.find((sale) => (instant(sale.starts_at) ?? -Infinity) <= at)
  if (running) {
    return { ...running, running: true }
  }
  const next = [...live].sort(
    (a, b) => (instant(a.starts_at) ?? 0) - (instant(b.starts_at) ?? 0)
  )[0]
  return next ? { ...next, running: false } : null
}
