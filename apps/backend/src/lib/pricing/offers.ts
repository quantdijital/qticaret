import { kurus, multiplyByRateBps } from "../money"
import type { Kurus } from "../money"
import type { PricePoint } from "./discount"

/**
 * Automatic promotions as the storefront shows them before the cart
 * (adr/0023 Ek 2026-11-05). One every shopper gets on a product, with no
 * code, cart minimum or condition on who buys, is the price itself: the
 * card and the product page show it, with the price before it under the
 * price-before rule. One whose only condition is the cart (a minimum) is
 * a hint beside the price ("Sepette %30 indirim"). Anything else (a
 * customer group, a region, a per-customer limit, "X al Y öde", free
 * shipping) stays in the cart. So does one with a limit that can run out
 * between the card and the cart (a campaign budget of spend or uses, or
 * the promotion's own uses): the card never shows a price the cart may
 * not give (adr/0076 Ek 2026-11-25). Pure: Medusa's promotion module says which
 * promotions apply to which variant; this file says how they are shown.
 */

export type OfferMethod = { type: "percentage"; value: number } | { type: "fixed"; value: Kurus }

/** A promotion that is the shopper's price, from the moment it could first apply. */
export interface PriceOffer {
  kind: "price"
  code: string
  method: OfferMethod
  since: Date
}

/** A promotion the cart applies once its condition is met: shown beside the price. */
export interface CartOffer {
  kind: "cart"
  code: string
  method: OfferMethod
  /** The least the cart must hold (KDV included, after discounts); null: none. */
  minimum: Kurus | null
}

export type Offer = PriceOffer | CartOffer

export type When = string | Date | null | undefined

export interface RuleRow {
  attribute?: string | null
  operator?: string | null
  values?: ({ value?: string | null } | null)[] | null
}

/** A promotion as Query reads it (`promotion` with its rules, method and campaign). */
export interface PromotionRow {
  code?: string | null
  type?: string | null
  status?: string | null
  is_automatic?: boolean | null
  is_tax_inclusive?: boolean | null
  created_at?: When
  /** How many times it may be used in all; null: no such limit. */
  limit?: number | string | null
  rules?: (RuleRow | null)[] | null
  application_method?: {
    type?: string | null
    target_type?: string | null
    allocation?: string | null
    value?: number | string | null
    max_quantity?: number | null
    currency_code?: string | null
    buy_rules_min_quantity?: number | null
  } | null
  campaign?: {
    starts_at?: When
    budget?: { type?: string | null; limit?: number | string | null } | null
  } | null
}

const numberOf = (value: number | string | null | undefined): number | null => {
  const amount = value === null || value === undefined ? Number.NaN : Number(value)
  return Number.isFinite(amount) ? amount : null
}

/**
 * A limit Medusa holds the promotion to, as its promotion module reads it:
 * the campaign's budget (spend or uses, in all or per attribute) once it
 * has a limit, the promotion's own count of uses once it is a number.
 * Either may run out between the card and the cart.
 */
export function isLimited(row: Pick<PromotionRow, "limit" | "campaign">): boolean {
  const budget = numberOf(row.campaign?.budget?.limit)
  return (budget !== null && budget > 0) || numberOf(row.limit) !== null
}

const valuesOf = (rule: RuleRow): string[] =>
  (rule.values ?? []).flatMap((each) => (each?.value ? [each.value] : []))

const liraToKurus = (lira: number): Kurus => kurus(Math.round(lira * 100))

/** What the promotion's own rules ask of the cart: nothing, a minimum, or more (null). */
function conditionOf(
  rules: readonly (RuleRow | null)[],
  currency: string
): { minimum: Kurus | null } | null {
  let minimum: Kurus | null = null
  for (const rule of rules) {
    if (!rule) {
      continue
    }
    const values = valuesOf(rule)
    if (rule.attribute === "currency_code" && ["eq", "in"].includes(rule.operator ?? "")) {
      // A currency every shopper here pays in is no condition; another one never applies
      if (!values.some((value) => value.toLowerCase() === currency)) {
        return null
      }
      continue
    }
    const amount = Number(values[0])
    if (
      rule.attribute === "item_total" &&
      ["gte", "gt"].includes(rule.operator ?? "") &&
      values.length === 1 &&
      Number.isFinite(amount) &&
      amount >= 0
    ) {
      minimum = liraToKurus(amount)
      continue
    }
    // A customer, a group, a region, an address, what else the cart holds: not shown before it
    return null
  }
  return { minimum }
}

/**
 * How a promotion is shown in a currency; null when it stays in the cart.
 * Medusa decides whether it applies now (status, dates, target products):
 * this reads its shape, and whether it has a limit at all (`isLimited`).
 */
export function offerOf(row: PromotionRow, currency: string): Offer | null {
  const method = row.application_method
  const value = Number(method?.value)
  if (
    !row.code ||
    row.is_automatic !== true ||
    row.status !== "active" ||
    row.type !== "standard" ||
    !method ||
    method.buy_rules_min_quantity ||
    !["order", "items"].includes(method.target_type ?? "") ||
    !Number.isFinite(value) ||
    value <= 0 ||
    // A limit on how many each promotion counts per customer is a condition on who buys
    row.campaign?.budget?.type === "use_by_attribute" ||
    // A budget or a count of uses: the cart alone applies it (adr/0076 Ek 2026-11-25)
    isLimited(row)
  ) {
    return null
  }
  const condition = conditionOf(row.rules ?? [], currency)
  if (!condition) {
    return null
  }
  let shape: OfferMethod
  if (method.type === "percentage" && value <= 100) {
    shape = { type: "percentage", value }
  } else if (method.type === "fixed" && method.currency_code?.toLowerCase() === currency) {
    shape = { type: "fixed", value: liraToKurus(value) }
  } else {
    return null
  }
  // A unit's price only when the offer is the same on every unit: a percentage on each line
  // without a cap on units, or an amount off each unit with KDV included
  const perUnit =
    !method.max_quantity &&
    (shape.type === "percentage" ||
      (method.allocation === "each" &&
        method.target_type === "items" &&
        row.is_tax_inclusive === true))
  if (condition.minimum === null && perUnit) {
    const created = row.created_at ? new Date(row.created_at) : new Date(0)
    const starts = row.campaign?.starts_at ? new Date(row.campaign.starts_at) : null
    // The earliest it could have applied: a later start only lowers the price before
    const since = starts && starts > created ? starts : created
    return { kind: "price", code: row.code, method: shape, since }
  }
  return { kind: "cart", code: row.code, method: shape, minimum: condition.minimum }
}

/** What the offers take off a unit at `amount`; each counts on the whole amount, together no more than it. */
export function offerDiscount(amount: Kurus, methods: readonly OfferMethod[]): Kurus {
  const total = methods.reduce(
    (sum, method) =>
      sum +
      (method.type === "percentage"
        ? multiplyByRateBps(amount, Math.round(method.value * 100))
        : Math.min(method.value, amount)),
    0
  )
  return kurus(Math.min(total, amount))
}

/** A unit's price at `amount` after the offers. */
export const offerPrice = (amount: Kurus, methods: readonly OfferMethod[]): Kurus =>
  kurus(amount - offerDiscount(amount, methods))

/**
 * The prices the shopper paid, from the recorded selling prices and the
 * automatic offers: from each offer's start on, a price is the offer's.
 * The price in force when an offer began becomes a point of its own then.
 * Counting an offer from its earliest possible start never raises the
 * price before a discount, so the struck-through price never overstates.
 */
export function pricesWithOffers(
  points: readonly PricePoint[],
  offers: readonly PriceOffer[]
): PricePoint[] {
  if (offers.length === 0) {
    return [...points]
  }
  const starts = [...new Set(offers.map((offer) => offer.since.getTime()))]
  const boundaries = starts.flatMap((at) => {
    if (points.some((point) => point.at.getTime() === at)) {
      return []
    }
    const inForce = points.filter((point) => point.at.getTime() < at).at(-1)
    return inForce ? [{ ...inForce, at: new Date(at) }] : []
  })
  return [...points, ...boundaries]
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .map((point) => {
      const methods = offers
        .filter((offer) => offer.since.getTime() <= point.at.getTime())
        .map((offer) => offer.method)
      return methods.length > 0 ? { ...point, amount: offerPrice(point.amount, methods) } : point
    })
}
