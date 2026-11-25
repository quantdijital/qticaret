import { ZERO_KURUS, addKurus, fromMedusaAmount, kurus, toMedusaAmount } from "../money"
import type { Kurus, MedusaAmount } from "../money"

/**
 * A customer's numbers on the panel (customers list, their page, the
 * order's "Müşteri geçmişi"): how many orders, what they came to, the
 * average basket, the last order and the city it went to. Counted the
 * way the sales report counts sales, so the two never disagree: orders
 * that are not drafts, archived or canceled, at their total, in lira.
 * Pure: the reader gathers the rows.
 */

/** The shop sells in lira (adr/0007); other currencies wait for F19, as in the reports. */
export const TOTALS_CURRENCY = "try"

/** Not sales, as the reports read them (dashboard/orders.ts NOT_ORDERS + canceled). */
export const NOT_SALES = ["draft", "archived", "canceled"] as const

export interface TotalsOrder {
  customer_id?: string | null
  status?: string | null
  currency_code?: string | null
  total?: MedusaAmount | null
  created_at: string | Date
  shipping_address?: { city?: string | null; province?: string | null } | null
}

export interface CustomerTotals {
  customer_id: string
  orders: number
  /** What the orders came to, a Medusa amount string ("1250.00"). */
  spent: string
  /** `spent / orders`, kuruş rounded; "0.00" without orders. */
  average: string
  last_order_at: string | null
  /** The last order's city (il), else the customer's own address's; null when none told. */
  city: string | null
}

interface Tally {
  orders: number
  spent: Kurus
  lastAt: Date | null
  city: string | null
}

const kurusOf = (value: MedusaAmount | null | undefined): Kurus =>
  value === null || value === undefined
    ? ZERO_KURUS
    : fromMedusaAmount(value, { allowRounding: true })

// Turkish addresses keep the il in `province`, the ilçe in `city` (F1.4)
const cityOf = (address: TotalsOrder["shipping_address"]): string | null => {
  const text = (address?.province ?? address?.city ?? "").trim()
  return text === "" ? null : text
}

const isSale = (order: TotalsOrder): boolean =>
  !NOT_SALES.includes((order.status ?? "") as (typeof NOT_SALES)[number]) &&
  (order.currency_code ?? TOTALS_CURRENCY).toLowerCase() === TOTALS_CURRENCY

/**
 * Each asked customer's totals, in the order asked; a customer without
 * orders reads zeros (and their own address's city, when given).
 */
export function customerTotals(
  customerIds: readonly string[],
  orders: readonly TotalsOrder[],
  ownCities: ReadonlyMap<string, string | null> = new Map()
): CustomerTotals[] {
  const tallies = new Map<string, Tally>(
    customerIds.map((id) => [id, { orders: 0, spent: ZERO_KURUS, lastAt: null, city: null }])
  )
  for (const order of orders) {
    const tally = order.customer_id ? tallies.get(order.customer_id) : undefined
    if (!tally || !isSale(order)) {
      continue
    }
    tally.orders += 1
    tally.spent = addKurus(tally.spent, kurusOf(order.total))
    const at = new Date(order.created_at)
    if (!tally.lastAt || at > tally.lastAt) {
      tally.lastAt = at
      tally.city = cityOf(order.shipping_address) ?? tally.city
    } else if (!tally.city) {
      tally.city = cityOf(order.shipping_address)
    }
  }
  return customerIds.map((id) => {
    const tally = tallies.get(id) ?? { orders: 0, spent: ZERO_KURUS, lastAt: null, city: null }
    const average = tally.orders === 0 ? ZERO_KURUS : kurus(Math.round(tally.spent / tally.orders))
    return {
      customer_id: id,
      orders: tally.orders,
      spent: toMedusaAmount(tally.spent),
      average: toMedusaAmount(average),
      last_order_at: tally.lastAt?.toISOString() ?? null,
      city: tally.city ?? ownCities.get(id) ?? null,
    }
  })
}
