import { dayEnd, dayOf, dayStart } from "@qticaret/admin-ui/lib/days"
import { formatMoneyInput, parseMoneyInput } from "@qticaret/admin-ui/lib/money-input"
import type { SaleChange, VariantSaleView } from "@/features/products/api/sale-prices"
import { percentOf } from "@/features/price-lists/form"

/** A variant's sale as its field edits it (adr/0086): Woo's "İndirimli fiyat" and "Zamanla". */
export interface SaleDraft {
  /** As typed, the Turkish way ("1.249,90"); empty: no sale. */
  amount: string
  /** "Zamanla" open: the two days show. */
  scheduled: boolean
  /** First and last day ("2026-12-01"), Turkey's days; empty: open on that side. */
  starts: string
  ends: string
}

export const EMPTY_SALE: SaleDraft = { amount: "", scheduled: false, starts: "", ends: "" }

/** The stored sale as the field starts from. */
export function saleDraftOf(sale: VariantSaleView | null | undefined): SaleDraft {
  if (!sale) {
    return EMPTY_SALE
  }
  const starts = dayOf(sale.starts_at)
  const ends = dayOf(sale.ends_at)
  return {
    amount: formatMoneyInput(Number(sale.amount)),
    scheduled: Boolean(starts || ends),
    starts,
    ends,
  }
}

// The same price however typed ("1250" and "1.250,00"); text that is no price differs from any
const sameAmount = (a: string, b: string) =>
  a.trim() === b.trim() ||
  (parseMoneyInput(a) !== null && parseMoneyInput(a) === parseMoneyInput(b))

/** Nothing to save: the same price and, when scheduled, the same days. */
export const sameDraft = (a: SaleDraft, b: SaleDraft): boolean =>
  sameAmount(a.amount, b.amount) &&
  (a.scheduled ? a.starts : "") === (b.scheduled ? b.starts : "") &&
  (a.scheduled ? a.ends : "") === (b.scheduled ? b.ends : "")

export interface SaleCheck {
  /** An i18n key under `products.sale.errors`; null when it may be saved. */
  error: string | null
  /** Off the regular price, whole percent, for the hint; null without a valid sale. */
  percent: number | null
}

const today = () => dayOf(new Date())

/**
 * What the server would refuse, said before saving: a sale must be a
 * price below the variant's regular one (an equal or higher one is no
 * sale), and its last day not before its first nor already past.
 */
export function checkSale(draft: SaleDraft, regular: number | null): SaleCheck {
  if (draft.amount.trim() === "") {
    return { error: null, percent: null }
  }
  const amount = parseMoneyInput(draft.amount)
  if (amount === null || amount <= 0) {
    return { error: "amount", percent: null }
  }
  if (regular === null) {
    return { error: "noRegular", percent: null }
  }
  if (amount >= regular) {
    return { error: "notBelow", percent: null }
  }
  if (draft.scheduled && draft.starts && draft.ends && draft.ends < draft.starts) {
    return { error: "datesOrder", percent: null }
  }
  if (draft.scheduled && draft.ends && draft.ends < today()) {
    return { error: "ended", percent: null }
  }
  return { error: null, percent: Math.round((1 - amount / regular) * 100) }
}

/** The request for one variant's sale: set with its days, or cleared when the price is empty. */
export function saleChangeOf(variantId: string, draft: SaleDraft): SaleChange {
  const amount = parseMoneyInput(draft.amount)
  if (amount === null) {
    return { clear: [variantId] }
  }
  return {
    set: [
      {
        variant_id: variantId,
        amount: amount.toFixed(2),
        starts_at: draft.scheduled ? (dayStart(draft.starts)?.toISOString() ?? null) : null,
        ends_at: draft.scheduled ? (dayEnd(draft.ends)?.toISOString() ?? null) : null,
      },
    ],
  }
}

export type BulkSaleMode = "price" | "percent" | "clear"

export interface BulkSaleDraft {
  mode: BulkSaleMode
  /** A price ("1.249,90") or a percentage ("15"), as typed. */
  value: string
  starts: string
  ends: string
}

/**
 * The request for the chosen variants (adr/0086): one sale price for all,
 * a percentage off each one's own price (worked out on the server), or
 * their sales cleared. Null when what is typed is no price or percentage.
 */
export function bulkSaleChange(
  variantIds: readonly string[],
  draft: BulkSaleDraft
): SaleChange | null {
  if (draft.mode === "clear") {
    return { clear: [...variantIds] }
  }
  const days = {
    starts_at: dayStart(draft.starts)?.toISOString() ?? null,
    ends_at: dayEnd(draft.ends)?.toISOString() ?? null,
  }
  if (draft.mode === "percent") {
    const percent = percentOf(draft.value)
    return percent === null
      ? null
      : { set: variantIds.map((variant_id) => ({ variant_id, percent, ...days })) }
  }
  const amount = parseMoneyInput(draft.value)
  return amount === null || amount <= 0
    ? null
    : { set: variantIds.map((variant_id) => ({ variant_id, amount: amount.toFixed(2), ...days })) }
}
