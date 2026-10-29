import type { MedusaContainer } from "@medusajs/framework/types"
import { createSingleFlight } from "../../../../lib/cache"
import {
  LIFECYCLE_FIELDS,
  buildOverview,
  periodWindow,
  rangeWindow,
} from "../../../../lib/dashboard"
import type {
  Overview,
  OverviewLimits,
  OverviewOrder,
  PeriodKey,
  PeriodWindow,
} from "../../../../lib/dashboard"
import { ValidationError } from "../../../../lib/errors"
import type { SalesOrder } from "../../../../lib/reports/sales"
import { SALES_DETAIL_FIELDS, salesDetails } from "../../reports/sales/details"
import type { SalesDetails } from "../../reports/sales/details"
import { ordersBetween } from "../orders"

// Statuses and amounts only: no customer, address or email (adr/0011)
const FIELDS = [
  "id",
  "created_at",
  "total",
  ...LIFECYCLE_FIELDS,
  "items.quantity",
  "items.product_id",
  "items.product_title",
  "items.thumbnail",
  "items.total",
  "items.product.categories.id",
  "items.product.categories.name",
]

// A minute is fresh enough for a dashboard and spares the order module's
// totals on every visit; one entry per period
const TTL_MS = 60_000

export type DashboardOverview = Overview & {
  period: { key: PeriodKey | "range"; granularity: "hour" | "day"; from: string; to: string }
  currency_code: string
  capped: boolean
}

// The shop sells in lira (adr/0007); orders in other currencies wait for F19
const CURRENCY = "try"

/** A report reads a year of orders: past this many the answer says it is capped. */
export const MAX_REPORT_ORDERS = 50_000

// Reports list every product sold (up to a page a person reads) and every category
export const REPORT_LIMITS: OverviewLimits = { products: 100, categories: 20 }

/** A preset period, or days a report names (Turkish days, `YYYY-MM-DD`, F11.1). */
export type ReportRange = { period: PeriodKey } | { from: string; to: string }

/** The range's window; a range that is no range is the caller's error. */
export function windowOf(range: ReportRange, now: Date = new Date()): PeriodWindow {
  if ("period" in range) {
    return periodWindow(range.period, now)
  }
  const window = rangeWindow(range.from, range.to, now)
  if (!window) {
    throw new ValidationError("reports.range_invalid", { field: "from" })
  }
  return window
}

/** The window's orders in lira with the given fields, the previous window's too. */
async function readWindow(
  scope: MedusaContainer,
  window: PeriodWindow,
  fields: string[],
  maxOrders?: number
) {
  const [current, previous] = await Promise.all([
    ordersBetween<OverviewOrder>(scope, fields, window.from, window.to, maxOrders),
    ordersBetween<OverviewOrder>(scope, fields, window.previousFrom, window.previousTo, maxOrders),
  ])
  const inLira = (rows: OverviewOrder[]) => rows.filter((row) => row.currency_code === CURRENCY)
  return {
    current: inLira(current.rows),
    previous: inLira(previous.rows),
    capped: current.count > current.rows.length || previous.count > previous.rows.length,
  }
}

function assemble(
  window: PeriodWindow,
  read: Awaited<ReturnType<typeof readWindow>>,
  limits?: OverviewLimits
): DashboardOverview {
  return {
    period: {
      key: window.key,
      granularity: window.granularity,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
    },
    currency_code: CURRENCY,
    capped: read.capped,
    ...buildOverview(window, read.current, read.previous, limits),
  }
}

/** The window's numbers, uncached; the dashboard's. */
export async function computeOverview(
  scope: MedusaContainer,
  window: PeriodWindow,
  limits?: OverviewLimits
): Promise<DashboardOverview> {
  return assemble(window, await readWindow(scope, window, FIELDS), limits)
}

export type SalesReport = DashboardOverview & { details: SalesDetails }

/**
 * The sales report's numbers (F11.1–F11.2), uncached: the dashboard's
 * over up to MAX_REPORT_ORDERS orders, with every product and category,
 * and brands, promotions, returns and traffic sources.
 */
export async function computeSalesReport(
  scope: MedusaContainer,
  window: PeriodWindow
): Promise<SalesReport> {
  const read = await readWindow(
    scope,
    window,
    [...FIELDS, ...SALES_DETAIL_FIELDS],
    MAX_REPORT_ORDERS
  )
  const sold = read.current.filter((order) => order.status !== "canceled")
  return {
    ...assemble(window, read, REPORT_LIMITS),
    details: await salesDetails(scope, sold as unknown as SalesOrder[]),
  }
}

const keyOf = (range: ReportRange): string =>
  "period" in range ? range.period : `${range.from}..${range.to}`

/**
 * A range's numbers, cached a minute per range; requests missing the
 * cache together wait for one computation.
 */
export function cached<T>(compute: (scope: MedusaContainer, window: PeriodWindow) => Promise<T>) {
  const cache = new Map<string, { at: number; value: T }>()
  const computing = createSingleFlight<T>()
  const read = async (scope: MedusaContainer, range: ReportRange): Promise<T> => {
    const window = windowOf(range)
    const key = keyOf(range)
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) {
      return hit.value
    }
    const value = await computing(key, () => compute(scope, window))
    // Named ranges come and go: keep at most a few
    if (cache.size > 50) {
      cache.clear()
    }
    cache.set(key, { at: Date.now(), value })
    return value
  }
  const clear = () => {
    cache.clear()
  }
  return { read, clear }
}

const dashboard = cached((scope, window) => computeOverview(scope, window))
const report = cached(computeSalesReport)

export const readDashboardOverview = (scope: MedusaContainer, period: PeriodKey) =>
  dashboard.read(scope, { period })
export const readSalesReport = report.read

/** Tests start from empty caches. */
export function clearDashboardCache(): void {
  dashboard.clear()
  report.clear()
}
