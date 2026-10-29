import { ZERO_KURUS, addKurus } from "../../money"
import type { Kurus } from "../../money"

/**
 * A provider's statement against the shop's payments (F11.3, adr/0039 §3):
 * pure, in kuruş. The day is a Turkish `YYYY-MM-DD`; both sides cover the
 * day before and after it as well, so a payment taken at midnight that
 * the provider books on the next day still matches.
 */

export const STATEMENT_PROVIDERS = ["paytr", "iyzico"] as const
export type StatementProvider = (typeof STATEMENT_PROVIDERS)[number]

/** One line of the provider's statement. */
export interface StatementRow {
  kind: "sale" | "refund"
  /** The provider's reference: PayTR's `merchant_oid`, iyzico's `paymentId`. */
  reference: string
  amount: Kurus
  /**
   * A second amount the provider shows for a sale (PayTR's `odeme_tutari`
   * beside `islem_tutari`); the sale matches when either is the shop's.
   */
  alternative?: Kurus | null
  day: string
}

/** A payment the shop took through the provider, live money only. */
export interface ShopPayment {
  reference: string
  order: { id: string; display_id: number } | null
  captures: { amount: Kurus; day: string }[]
  refunds: { amount: Kurus; day: string }[]
}

export const STATEMENT_ISSUES = [
  // The shop took it, the provider shows no sale
  "missing_at_provider",
  // The provider took money the shop has no payment for
  "unknown_at_shop",
  "amount_mismatch",
  "refund_mismatch",
] as const
export type StatementIssueKind = (typeof STATEMENT_ISSUES)[number]

export interface StatementIssue {
  kind: StatementIssueKind
  reference: string
  order_id: string | null
  display_id: number | null
  /** Kuruş, as each side has it. */
  shop: number
  provider: number
}

export interface StatementMatch {
  /** The shop's payments taken on the day that the statement agrees with. */
  matched: number
  /** The provider's sales on the day. */
  sales: number
  issues: StatementIssue[]
}

const sum = (amounts: readonly Kurus[]): Kurus => amounts.reduce(addKurus, ZERO_KURUS)

/**
 * Every payment taken on `day` must be a sale of the same amount; every
 * sale on `day` must be a payment of the shop's (or one `known` to have
 * become no order, adr/0026 §6); a reference refunded on `day` must have
 * been refunded alike on both sides.
 */
export function matchStatement(
  day: string,
  shop: readonly ShopPayment[],
  rows: readonly StatementRow[],
  known: ReadonlySet<string> = new Set()
): StatementMatch {
  const rowsOf = new Map<string, StatementRow[]>()
  for (const row of rows) {
    rowsOf.set(row.reference, [...(rowsOf.get(row.reference) ?? []), row])
  }
  const shopOf = new Map(shop.map((payment) => [payment.reference, payment]))
  const issue = (
    kind: StatementIssueKind,
    reference: string,
    amounts: { shop: Kurus; provider: Kurus }
  ): StatementIssue => {
    const order = shopOf.get(reference)?.order ?? null
    return {
      kind,
      reference,
      order_id: order?.id ?? null,
      display_id: order?.display_id ?? null,
      ...amounts,
    }
  }
  const issues: StatementIssue[] = []
  let matched = 0

  for (const payment of shop.filter((entry) => entry.captures.some((c) => c.day === day))) {
    const captured = sum(payment.captures.map((capture) => capture.amount))
    const sales = (rowsOf.get(payment.reference) ?? []).filter((row) => row.kind === "sale")
    const provider = sum(sales.map((row) => row.amount))
    const alternative = sum(sales.map((row) => row.alternative ?? row.amount))
    if (sales.length === 0) {
      issues.push(issue("missing_at_provider", payment.reference, { shop: captured, provider }))
    } else if (captured !== provider && captured !== alternative) {
      issues.push(issue("amount_mismatch", payment.reference, { shop: captured, provider }))
    } else {
      matched += 1
    }
  }

  const daySales = rows.filter((row) => row.kind === "sale" && row.day === day)
  for (const reference of new Set(daySales.map((row) => row.reference))) {
    if (!shopOf.has(reference) && !known.has(reference)) {
      const provider = sum(
        daySales.filter((row) => row.reference === reference).map((row) => row.amount)
      )
      issues.push(issue("unknown_at_shop", reference, { shop: ZERO_KURUS, provider }))
    }
  }

  const refunded = new Set([
    ...shop.filter((p) => p.refunds.some((r) => r.day === day)).map((p) => p.reference),
    ...rows.filter((row) => row.kind === "refund" && row.day === day).map((row) => row.reference),
  ])
  for (const reference of refunded) {
    // A payment that became no order is refunded by the recovery job, not by an order
    if (!shopOf.has(reference) && known.has(reference)) {
      continue
    }
    const shopSide = sum(shopOf.get(reference)?.refunds.map((refund) => refund.amount) ?? [])
    const providerSide = sum(
      (rowsOf.get(reference) ?? []).filter((row) => row.kind === "refund").map((row) => row.amount)
    )
    if (shopSide !== providerSide) {
      issues.push(issue("refund_mismatch", reference, { shop: shopSide, provider: providerSide }))
    }
  }

  return { matched, sales: daySales.length, issues }
}

/** The day before and after a `YYYY-MM-DD` day, as the statement window has them. */
export function aroundDay(day: string): { before: string; after: string } {
  const at = Date.parse(`${day}T00:00:00Z`)
  const shift = (days: number) =>
    new Date(at + days * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
  return { before: shift(-1), after: shift(1) }
}
