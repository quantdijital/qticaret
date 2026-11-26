import { ZERO_KURUS, addKurus, fromMedusaAmount, kurus, toMedusaAmount } from "../money"
import type { Kurus, MedusaAmount } from "../money"
import { NOT_SALES, TOTALS_CURRENCY } from "./totals"

/**
 * The customers report (R1): new customers over the period against the
 * one before, who bought in it and how many of them had bought before,
 * and the customers who spent most. Sales are counted as the customer
 * totals count them (`totals.ts`): no drafts, archived or canceled, in
 * lira. Pure: the reader gathers the rows.
 */

export const TOP_CUSTOMERS = 10

export interface ReportWindowLike {
  from: Date
  to: Date
  previousFrom: Date
  previousTo: Date
  buckets: Date[]
  bucketMs: number
}

export interface NewCustomerRow {
  created_at: string | Date
  has_account?: boolean | null
}

export interface SaleRow {
  customer_id?: string | null
  status?: string | null
  currency_code?: string | null
  total?: MedusaAmount | null
  created_at: string | Date
}

// A sale as the customer totals count one (`totals.ts`)
const isSale = (sale: SaleRow): boolean =>
  !NOT_SALES.includes((sale.status ?? "") as (typeof NOT_SALES)[number]) &&
  (sale.currency_code ?? TOTALS_CURRENCY).toLowerCase() === TOTALS_CURRENCY

export interface TopCustomer {
  customer_id: string
  orders: number
  /** A Medusa amount string ("1250.00"). */
  spent: string
}

export interface CustomersReport {
  new_customers: {
    current: number
    previous: number
    registered: number
    guest: number
  }
  /** New customers per bucket, this period and the one before at the same place. */
  series: { bucket: string; current: number; previous: number }[]
  /** Customers who bought in the period, and those of them who had bought before it. */
  buyers: number
  returning: number
  /** `returning / buyers`, 0 without buyers. */
  returning_rate: number
  /** What a buyer spent in the period on average, a Medusa amount string. */
  spent_per_buyer: string
  top: TopCustomer[]
}

const time = (at: string | Date) => new Date(at).getTime()

const kurusOf = (value: MedusaAmount | null | undefined): Kurus =>
  value === null || value === undefined
    ? ZERO_KURUS
    : fromMedusaAmount(value, { allowRounding: true })

/** The index of the bucket an instant falls in, or -1 outside them. */
function bucketIndex(at: number, start: number, window: ReportWindowLike): number {
  const index = Math.floor((at - start) / window.bucketMs)
  return index >= 0 && index < window.buckets.length ? index : -1
}

export function customersReport(
  window: ReportWindowLike,
  newCustomers: readonly NewCustomerRow[],
  sales: readonly SaleRow[],
  boughtBefore: ReadonlySet<string>
): CustomersReport {
  const from = window.from.getTime()
  const to = window.to.getTime()
  const previousFrom = window.previousFrom.getTime()
  const previousTo = window.previousTo.getTime()
  const series = window.buckets.map((bucket) => ({
    bucket: bucket.toISOString(),
    current: 0,
    previous: 0,
  }))
  const counts = { current: 0, previous: 0, registered: 0, guest: 0 }
  for (const customer of newCustomers) {
    const at = time(customer.created_at)
    if (at >= from && at < to) {
      counts.current += 1
      counts[customer.has_account ? "registered" : "guest"] += 1
      const slot = series[bucketIndex(at, from, window)]
      if (slot) {
        slot.current += 1
      }
    } else if (at >= previousFrom && at < previousTo) {
      counts.previous += 1
      const slot = series[bucketIndex(at, previousFrom, window)]
      if (slot) {
        slot.previous += 1
      }
    }
  }
  const tallies = new Map<string, { orders: number; spent: Kurus }>()
  let total = ZERO_KURUS
  for (const sale of sales) {
    const at = time(sale.created_at)
    if (!sale.customer_id || at < from || at >= to || !isSale(sale)) {
      continue
    }
    const tally = tallies.get(sale.customer_id) ?? {
      orders: 0,
      spent: ZERO_KURUS,
    }
    tally.orders += 1
    tally.spent = addKurus(tally.spent, kurusOf(sale.total))
    total = addKurus(total, kurusOf(sale.total))
    tallies.set(sale.customer_id, tally)
  }
  const buyers = tallies.size
  const returning = [...tallies.keys()].filter((id) => boughtBefore.has(id)).length
  const top = [...tallies.entries()]
    .sort(([a, x], [b, y]) => y.spent - x.spent || y.orders - x.orders || a.localeCompare(b))
    .slice(0, TOP_CUSTOMERS)
    .map(([id, tally]) => ({
      customer_id: id,
      orders: tally.orders,
      spent: toMedusaAmount(tally.spent),
    }))
  return {
    new_customers: counts,
    series,
    buyers,
    returning,
    returning_rate: buyers === 0 ? 0 : returning / buyers,
    spent_per_buyer: toMedusaAmount(buyers === 0 ? ZERO_KURUS : kurus(Math.round(total / buyers))),
    top,
  }
}
