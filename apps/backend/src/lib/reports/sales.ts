import { ZERO_KURUS, addKurus, fromMedusaAmount, toMedusaAmount } from "../money"
import type { Kurus, MedusaAmount } from "../money"
import { TRAFFIC_SOURCES } from "./traffic"
import type { TrafficSource } from "./traffic"

/**
 * The sales report's other cuts (F11.2, adr/0039 §2), from the period's
 * sold orders: brands, promotion codes, returns and exchanges, and where
 * the shoppers came from. Pure: the reader gathers the rows, these only
 * add up kuruş, so the totals are the orders' own (KK1).
 */

type Rows<T> = (T | null)[] | null | undefined

interface Adjustment {
  code?: string | null
  amount?: MedusaAmount | null
}

export interface SalesItem {
  total?: MedusaAmount | null
  product?: { brand?: { id: string; name: string } | null } | null
  adjustments?: Rows<Adjustment>
}

export interface SalesOrder {
  id: string
  total: MedusaAmount
  items?: Rows<SalesItem>
  shipping_methods?: Rows<{ adjustments?: Rows<Adjustment> }>
  cart?: { id: string } | null
  payment_collections?: Rows<{ refunded_amount?: MedusaAmount | null }>
}

const kurusOf = (value: MedusaAmount | null | undefined): Kurus =>
  value === null || value === undefined
    ? ZERO_KURUS
    : fromMedusaAmount(value, { allowRounding: true })

const present = <T>(rows: Rows<T>): T[] => (rows ?? []).filter((row): row is T => row !== null)

/** Sales by brand, the largest first; items of a product without one under `null`. */
export function brandSales(orders: readonly SalesOrder[], limit: number) {
  const byBrand = new Map<string, { name: string | null; sales: Kurus; units: number }>()
  for (const item of orders.flatMap((order) => present(order.items))) {
    const brand = item.product?.brand ?? null
    const key = brand?.id ?? "none"
    const entry = byBrand.get(key) ?? { name: brand?.name ?? null, sales: ZERO_KURUS, units: 0 }
    entry.sales = addKurus(entry.sales, kurusOf(item.total))
    byBrand.set(key, entry)
  }
  return [...byBrand.entries()]
    .sort(([, a], [, b]) => b.sales - a.sales)
    .slice(0, limit)
    .map(([key, entry]) => ({ key, name: entry.name, sales: toMedusaAmount(entry.sales) }))
}

/**
 * What each promotion code did: the orders it went on, the discount it
 * gave (its lines' and shipping's adjustments) and those orders' sales.
 * An automatic promotion without a code is under `null`.
 */
export function promotionEffect(orders: readonly SalesOrder[]) {
  const byCode = new Map<string, { orders: Set<string>; discount: Kurus; sales: Kurus }>()
  for (const order of orders) {
    const adjustments = [
      ...present(order.items).flatMap((item) => present(item.adjustments)),
      ...present(order.shipping_methods).flatMap((method) => present(method.adjustments)),
    ]
    const counted = new Set<string>()
    for (const adjustment of adjustments) {
      const code = adjustment.code ?? ""
      const entry = byCode.get(code) ?? {
        orders: new Set(),
        discount: ZERO_KURUS,
        sales: ZERO_KURUS,
      }
      entry.discount = addKurus(entry.discount, kurusOf(adjustment.amount))
      if (!counted.has(code)) {
        counted.add(code)
        entry.orders.add(order.id)
        entry.sales = addKurus(entry.sales, kurusOf(order.total))
      }
      byCode.set(code, entry)
    }
  }
  return [...byCode.entries()]
    .sort(([, a], [, b]) => b.sales - a.sales)
    .map(([code, entry]) => ({
      code: code === "" ? null : code,
      orders: entry.orders.size,
      discount: toMedusaAmount(entry.discount),
      sales: toMedusaAmount(entry.sales),
    }))
}

/**
 * How many of the period's orders asked for a return or an exchange (a
 * request not refused or withdrawn), and the money refunded on them.
 */
export function returnRates(
  orders: readonly SalesOrder[],
  requests: readonly { order_id: string; kind: "return" | "exchange" }[]
) {
  const ids = new Set(orders.map((order) => order.id))
  const returned = new Set<string>()
  const exchanged = new Set<string>()
  for (const request of requests) {
    if (ids.has(request.order_id)) {
      ;(request.kind === "exchange" ? exchanged : returned).add(request.order_id)
    }
  }
  const refunded = orders
    .flatMap((order) => present(order.payment_collections))
    .reduce((sum, collection) => addKurus(sum, kurusOf(collection.refunded_amount)), ZERO_KURUS)
  const rate = (count: number) => (ids.size === 0 ? 0 : count / ids.size)
  return {
    orders: ids.size,
    returned: returned.size,
    exchanged: exchanged.size,
    return_rate: rate(returned.size),
    exchange_rate: rate(exchanged.size),
    refunded: toMedusaAmount(refunded),
  }
}

/** Orders and sales by where their cart's shopper first landed from; none told is `unknown`. */
export function sourceSales(
  orders: readonly SalesOrder[],
  sources: ReadonlyMap<string, TrafficSource>
) {
  const keys = [...TRAFFIC_SOURCES, "unknown"] as const
  const bySource = new Map(keys.map((key) => [key, { orders: 0, sales: ZERO_KURUS }]))
  for (const order of orders) {
    const key = (order.cart ? sources.get(order.cart.id) : undefined) ?? "unknown"
    const entry = bySource.get(key)
    if (entry) {
      entry.orders += 1
      entry.sales = addKurus(entry.sales, kurusOf(order.total))
    }
  }
  return keys.map((source) => {
    const entry = bySource.get(source) ?? { orders: 0, sales: ZERO_KURUS }
    return { source, orders: entry.orders, sales: toMedusaAmount(entry.sales) }
  })
}
