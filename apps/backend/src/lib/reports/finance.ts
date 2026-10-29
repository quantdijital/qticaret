import { ZERO_KURUS, addKurus, fromMedusaAmount, subtractKurus, toMedusaAmount } from "../money"
import type { Kurus, MedusaAmount } from "../money"

/**
 * The finance report's cuts (F11.3, adr/0039 §3), from the period's sold
 * orders: sales by VAT rate (lines and shipping, each line's own rate),
 * and money taken and given back by payment method. Pure, in kuruş.
 */

type Rows<T> = (T | null)[] | null | undefined

interface TaxedLine {
  total?: MedusaAmount | null
  tax_total?: MedusaAmount | null
  tax_lines?: Rows<{ rate?: number | string | null }>
}

interface Payment {
  provider_id?: string | null
  captures?: Rows<{ amount?: MedusaAmount | null }>
  refunds?: Rows<{ amount?: MedusaAmount | null }>
}

export interface FinanceOrder {
  id: string
  items?: Rows<TaxedLine>
  shipping_methods?: Rows<TaxedLine>
  payment_collections?: Rows<{ payments?: Rows<Payment> }>
}

const kurusOf = (value: MedusaAmount | null | undefined): Kurus =>
  value === null || value === undefined
    ? ZERO_KURUS
    : fromMedusaAmount(value, { allowRounding: true })

const present = <T>(rows: Rows<T>): T[] => (rows ?? []).filter((row): row is T => row !== null)

/** A line's VAT rate in percent; one without a tax line is 0 (exempt or not taxed). */
const rateOf = (line: TaxedLine): number =>
  present(line.tax_lines).reduce((sum, tax) => sum + Number(tax.rate ?? 0), 0)

/**
 * Sales by VAT rate: the base (matrah), the VAT and the gross, lines and
 * shipping together, the highest rate first. Amounts are the lines' own
 * totals after discounts, KDV included as the shop prices.
 */
export function vatBreakdown(orders: readonly FinanceOrder[]) {
  const byRate = new Map<number, { gross: Kurus; tax: Kurus }>()
  for (const line of orders.flatMap((order) => [
    ...present(order.items),
    ...present(order.shipping_methods),
  ])) {
    const rate = rateOf(line)
    const entry = byRate.get(rate) ?? { gross: ZERO_KURUS, tax: ZERO_KURUS }
    entry.gross = addKurus(entry.gross, kurusOf(line.total))
    entry.tax = addKurus(entry.tax, kurusOf(line.tax_total))
    byRate.set(rate, entry)
  }
  return [...byRate.entries()]
    .sort(([a], [b]) => b - a)
    .map(([rate, entry]) => ({
      rate,
      base: toMedusaAmount(subtractKurus(entry.gross, entry.tax)),
      tax: toMedusaAmount(entry.tax),
      gross: toMedusaAmount(entry.gross),
    }))
}

/** `pp_paytr_paytr` → `paytr`: the method a payment provider id stands for. */
export const methodOf = (providerId: string | null | undefined): string => {
  const id = providerId ?? ""
  const match = /^pp_([^_]+)_/.exec(id)
  return match?.[1] ?? (id || "unknown")
}

/** Money taken and given back by payment method, the most taken first. */
export function collections(orders: readonly FinanceOrder[]) {
  const byMethod = new Map<string, { payments: number; captured: Kurus; refunded: Kurus }>()
  const payments = orders.flatMap((order) =>
    present(order.payment_collections).flatMap((collection) => present(collection.payments))
  )
  for (const payment of payments) {
    const method = methodOf(payment.provider_id)
    const entry = byMethod.get(method) ?? {
      payments: 0,
      captured: ZERO_KURUS,
      refunded: ZERO_KURUS,
    }
    entry.payments += 1
    for (const capture of present(payment.captures)) {
      entry.captured = addKurus(entry.captured, kurusOf(capture.amount))
    }
    for (const refund of present(payment.refunds)) {
      entry.refunded = addKurus(entry.refunded, kurusOf(refund.amount))
    }
    byMethod.set(method, entry)
  }
  return [...byMethod.entries()]
    .sort(([, a], [, b]) => b.captured - a.captured)
    .map(([method, entry]) => ({
      method,
      payments: entry.payments,
      captured: toMedusaAmount(entry.captured),
      refunded: toMedusaAmount(entry.refunded),
      net: toMedusaAmount(subtractKurus(entry.captured, entry.refunded)),
    }))
}
