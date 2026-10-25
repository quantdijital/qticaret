import { ZERO_KURUS, addKurus, fromMedusaAmount, kurus, toMedusaAmount } from "../money"
import type { Kurus, MedusaAmount } from "../money"
import { LIFECYCLES, lifecycleOf } from "./lifecycle"
import type { Lifecycle, LifecycleOrder } from "./lifecycle"
import { bucketIndex } from "./period"
import type { PeriodWindow } from "./period"

/**
 * The dashboard's numbers from orders read without personal data: totals
 * against the previous window, a series per bucket, where orders stand,
 * best sellers and sales by category. Amounts are summed in kuruş and
 * answered as Medusa amount strings; canceled orders are no sales.
 */

export interface OverviewItem {
  product_id?: string | null
  product_title?: string | null
  thumbnail?: string | null
  quantity?: number | null
  total?: MedusaAmount | null
  product?: { categories?: ({ id: string; name: string } | null)[] | null } | null
}

export interface OverviewOrder extends LifecycleOrder {
  created_at: string | Date
  total: MedusaAmount
  items?: (OverviewItem | null)[] | null
}

/** How many products and categories the answer lists: five for the dashboard, more for reports. */
export interface OverviewLimits {
  products: number
  categories: number
}

const DASHBOARD_LIMITS: OverviewLimits = { products: 5, categories: 5 }

const kurusOf = (value: MedusaAmount | null | undefined): Kurus =>
  value === null || value === undefined
    ? ZERO_KURUS
    : fromMedusaAmount(value, { allowRounding: true })

const presentItems = (order: OverviewOrder): OverviewItem[] =>
  (order.items ?? []).filter((item): item is OverviewItem => item !== null)

interface Tally {
  sales: Kurus
  orders: number
  units: number
}

function tally(orders: OverviewOrder[]): Tally {
  let sales = ZERO_KURUS
  let units = 0
  for (const order of orders) {
    sales = addKurus(sales, kurusOf(order.total))
    units += presentItems(order).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
  }
  return { sales, orders: orders.length, units }
}

const average = ({ sales, orders }: Tally): string =>
  toMedusaAmount(kurus(orders === 0 ? 0 : Math.round(sales / orders)))

function series(window: PeriodWindow, current: OverviewOrder[], previous: OverviewOrder[]) {
  const count = window.buckets.length
  const rows = window.buckets.map((start) => ({
    bucket: start.toISOString(),
    sales: ZERO_KURUS,
    orders: 0,
    units: 0,
    previous_sales: ZERO_KURUS,
    previous_orders: 0,
  }))
  for (const order of current) {
    const row = rows[bucketIndex(window.from, window.bucketMs, count, new Date(order.created_at))]
    if (row) {
      row.sales = addKurus(row.sales, kurusOf(order.total))
      row.orders += 1
      row.units += presentItems(order).reduce((sum, item) => sum + (item.quantity ?? 0), 0)
    }
  }
  for (const order of previous) {
    const at = new Date(order.created_at)
    const row = rows[bucketIndex(window.previousFrom, window.bucketMs, count, at)]
    if (row) {
      row.previous_sales = addKurus(row.previous_sales, kurusOf(order.total))
      row.previous_orders += 1
    }
  }
  return rows.map((row) => ({
    ...row,
    sales: toMedusaAmount(row.sales),
    previous_sales: toMedusaAmount(row.previous_sales),
  }))
}

function topProducts(orders: OverviewOrder[], limit: number) {
  const byProduct = new Map<
    string,
    { title: string; thumbnail: string | null; units: number; sales: Kurus }
  >()
  for (const item of orders.flatMap(presentItems)) {
    if (!item.product_id) {
      continue
    }
    const entry = byProduct.get(item.product_id) ?? {
      title: item.product_title ?? "",
      thumbnail: item.thumbnail ?? null,
      units: 0,
      sales: ZERO_KURUS,
    }
    entry.units += item.quantity ?? 0
    entry.sales = addKurus(entry.sales, kurusOf(item.total))
    byProduct.set(item.product_id, entry)
  }
  return [...byProduct.entries()]
    .sort(([, a], [, b]) => b.sales - a.sales || b.units - a.units)
    .slice(0, limit)
    .map(([product_id, entry]) => ({ product_id, ...entry, sales: toMedusaAmount(entry.sales) }))
}

// An item's sales go to its product's first category by name; none → uncategorized
function categoryOf(item: OverviewItem): { id: string; name: string } | null {
  const categories = (item.product?.categories ?? []).filter(
    (category): category is { id: string; name: string } => category !== null
  )
  return categories.sort((a, b) => a.name.localeCompare(b.name, "tr"))[0] ?? null
}

function categorySales(orders: OverviewOrder[], limit: number) {
  const byCategory = new Map<string, { name: string | null; sales: Kurus }>()
  for (const item of orders.flatMap(presentItems)) {
    const category = categoryOf(item)
    const key = category?.id ?? "uncategorized"
    const entry = byCategory.get(key) ?? { name: category?.name ?? null, sales: ZERO_KURUS }
    entry.sales = addKurus(entry.sales, kurusOf(item.total))
    byCategory.set(key, entry)
  }
  const ranked = [...byCategory.entries()].sort(([, a], [, b]) => b.sales - a.sales)
  const shown = ranked.slice(0, limit)
  const rest = ranked
    .slice(limit)
    .reduce((sum, [, entry]) => addKurus(sum, entry.sales), ZERO_KURUS)
  return [
    ...shown.map(([key, entry]) => ({
      key,
      name: entry.name,
      kind: key === "uncategorized" ? ("uncategorized" as const) : ("category" as const),
      sales: toMedusaAmount(entry.sales),
    })),
    ...(rest > 0
      ? [{ key: "other", name: null, kind: "other" as const, sales: toMedusaAmount(rest) }]
      : []),
  ]
}

export function buildOverview(
  window: PeriodWindow,
  current: OverviewOrder[],
  previous: OverviewOrder[],
  limits: OverviewLimits = DASHBOARD_LIMITS
) {
  const sold = (orders: OverviewOrder[]) => orders.filter((order) => order.status !== "canceled")
  const now = tally(sold(current))
  const before = tally(sold(previous))
  const statuses = Object.fromEntries(LIFECYCLES.map((name) => [name, 0])) as Record<
    Lifecycle,
    number
  >
  for (const order of current) {
    statuses[lifecycleOf(order)] += 1
  }
  return {
    totals: {
      sales: { current: toMedusaAmount(now.sales), previous: toMedusaAmount(before.sales) },
      orders: { current: now.orders, previous: before.orders },
      average_order: { current: average(now), previous: average(before) },
      units: { current: now.units, previous: before.units },
    },
    series: series(window, sold(current), sold(previous)),
    statuses,
    top_products: topProducts(sold(current), limits.products),
    categories: categorySales(sold(current), limits.categories),
  }
}

export type Overview = ReturnType<typeof buildOverview>
