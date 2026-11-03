import type { Kurus } from "../money"
import { kurus, multiplyByRateBps, sumKurus } from "../money"
import { MAX_LINK_HOURS } from "./token"

/**
 * What a payment link offers (adr/0051 §1, §2): its lines as priced when it
 * was made, and its discount. Prices are the catalog's at that moment and
 * never the request's (rule 5); opening the link checks them against the
 * catalog again, and a price that moved stops it.
 */

export const PAYMENT_LINK_STATUSES = ["draft", "open", "paid", "expired", "canceled"] as const
export type PaymentLinkStatus = (typeof PAYMENT_LINK_STATUSES)[number]

export interface PaymentLinkLine {
  variant_id: string
  product_id: string | null
  quantity: number
  title: string
  variant_title: string | null
  thumbnail: string | null
  /** Kuruş, KDV included: the catalog's price for this quantity when the link was made. */
  unit_price: number
}

export type DiscountType = "percentage" | "fixed"

export interface PaymentLinkDiscount {
  type: DiscountType
  /** Percent for `percentage` (1–99), kuruş for `fixed`. */
  value: number
  /** Kuruş off the lines, as worked out when the link was made. */
  amount: number
  reason: string
}

export const MAX_LINES = 50
export const MAX_QUANTITY = 999
/** A link's order still costs something: a discount stops short of the whole (the owner's limit). */
export const MAX_DISCOUNT_PERCENT = 99
/** After its end, a payment already under way may still complete for this long. */
export const COMPLETION_GRACE_MS = 60 * 60 * 1000
/** A closed link's personal data stays this long (docs/kvkk-envanter.md). */
export const RETENTION_DAYS = 30

export const linesTotal = (lines: readonly PaymentLinkLine[]): Kurus =>
  sumKurus(lines.map((line) => kurus(line.unit_price * line.quantity)))

/** The discount's kuruş off `itemsTotal`, never more than all of it. */
export function discountAmount(type: DiscountType, value: number, itemsTotal: Kurus): Kurus {
  const off = type === "percentage" ? multiplyByRateBps(itemsTotal, value * 100) : kurus(value)
  return kurus(Math.min(off, itemsTotal))
}

export type DiscountProblem =
  | "payment_link.discount_not_allowed"
  | "payment_link.discount_over_limit"
  | "payment_link.discount_invalid"

/**
 * Whether the role may give this discount: `operations` none (adr/0051
 * soru 1), `admin` up to the shop's limit for them (`payment_links`
 * settings, percent), the owner up to just below the whole.
 */
export function discountProblem(
  role: string | null,
  discount: { type: DiscountType; value: number },
  itemsTotal: Kurus,
  adminMaxPercent: number
): DiscountProblem | null {
  if (role !== "owner" && role !== "admin") {
    return "payment_link.discount_not_allowed"
  }
  const amount = discountAmount(discount.type, discount.value, itemsTotal)
  const percentOff = itemsTotal > 0 ? (amount * 100) / itemsTotal : 100
  if (
    amount <= 0 ||
    discount.value <= 0 ||
    (discount.type === "percentage" && discount.value > MAX_DISCOUNT_PERCENT) ||
    percentOff > MAX_DISCOUNT_PERCENT
  ) {
    return "payment_link.discount_invalid"
  }
  return role === "admin" && percentOff > adminMaxPercent
    ? "payment_link.discount_over_limit"
    : null
}

/** Lines whose price now differs from the snapshot, by variant (a variant gone counts). */
export function movedPrices(
  snapshot: readonly PaymentLinkLine[],
  current: ReadonlyMap<string, number | null>
): string[] {
  return snapshot
    .filter((line) => current.get(line.variant_id) !== line.unit_price)
    .map((line) => line.variant_id)
}

export interface CartLineFacts {
  variant_id: string | null
  quantity: number
  /** Kuruş. */
  unit_price: number
}

/**
 * How a cart opened from a link differs from it, if it does: a line added,
 * removed or of another quantity (`changed`), or priced otherwise (`prices`).
 */
export function cartDifference(
  snapshot: readonly PaymentLinkLine[],
  lines: readonly CartLineFacts[]
): "changed" | "prices" | null {
  const wanted = new Map<string, number>()
  for (const line of snapshot) {
    wanted.set(line.variant_id, (wanted.get(line.variant_id) ?? 0) + line.quantity)
  }
  const had = new Map<string, number>()
  for (const line of lines) {
    if (!line.variant_id) {
      return "changed"
    }
    had.set(line.variant_id, (had.get(line.variant_id) ?? 0) + line.quantity)
  }
  if (had.size !== wanted.size || [...wanted].some(([id, count]) => had.get(id) !== count)) {
    return "changed"
  }
  const price = new Map(snapshot.map((line) => [line.variant_id, line.unit_price]))
  return lines.some((line) => price.get(line.variant_id ?? "") !== line.unit_price)
    ? "prices"
    : null
}

interface Lifetime {
  status: string
  expires_at: Date | string
}

/** Whether a customer may open the link now: open, and before its end. */
export const isOpen = (link: Lifetime, now = new Date()): boolean =>
  link.status === "open" && new Date(link.expires_at).getTime() > now.getTime()

/** Whether a payment started from the link may still become its order. */
export const completesNow = (link: Lifetime, now = new Date()): boolean =>
  link.status === "open" &&
  new Date(link.expires_at).getTime() + COMPLETION_GRACE_MS > now.getTime()

/** A new link's end: `hours` from now, within one hour and seven days. */
export function linkEnd(hours: number, now = new Date()): Date {
  const bounded = Math.min(Math.max(Math.round(hours), 1), MAX_LINK_HOURS)
  return new Date(now.getTime() + bounded * 60 * 60 * 1000)
}

/**
 * An extended end: `hours` from now, but never past the token's own end
 * (seven days from the making). Null when the link cannot go further.
 */
export function extendedEnd(
  link: { expires_at: Date | string; token_ends_at: Date | string },
  hours: number,
  now = new Date()
): Date | null {
  const cap = new Date(link.token_ends_at).getTime()
  const end = Math.min(linkEnd(hours, now).getTime(), cap)
  return end > new Date(link.expires_at).getTime() && end > now.getTime() ? new Date(end) : null
}

/** `PL-1042`: the number staff and the customer say. */
export const linkNumber = (number: number): string => `PL-${String(number)}`
