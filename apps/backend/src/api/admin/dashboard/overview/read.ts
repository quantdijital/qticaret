import type { MedusaContainer } from "@medusajs/framework/types"
import { createSingleFlight } from "../../../../lib/cache"
import { LIFECYCLE_FIELDS, buildOverview, periodWindow } from "../../../../lib/dashboard"
import type { Overview, OverviewLimits, OverviewOrder, PeriodKey } from "../../../../lib/dashboard"
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
  period: { key: PeriodKey; granularity: "hour" | "day"; from: string; to: string }
  currency_code: string
  capped: boolean
}

// The shop sells in lira (adr/0007); orders in other currencies wait for F19
const CURRENCY = "try"

/** The period's numbers, uncached; reports ask for longer lists than the dashboard. */
export async function computeOverview(
  scope: MedusaContainer,
  key: PeriodKey,
  limits?: OverviewLimits
): Promise<DashboardOverview> {
  const window = periodWindow(key)
  const [current, previous] = await Promise.all([
    ordersBetween<OverviewOrder>(scope, FIELDS, window.from, window.to),
    ordersBetween<OverviewOrder>(scope, FIELDS, window.previousFrom, window.previousTo),
  ])
  const inLira = (rows: OverviewOrder[]) => rows.filter((row) => row.currency_code === CURRENCY)
  return {
    period: {
      key,
      granularity: window.granularity,
      from: window.from.toISOString(),
      to: window.to.toISOString(),
    },
    currency_code: CURRENCY,
    capped: current.count > current.rows.length || previous.count > previous.rows.length,
    ...buildOverview(window, inLira(current.rows), inLira(previous.rows), limits),
  }
}

/**
 * A period's overview, cached a minute per period; requests missing the
 * cache together wait for one computation. One reader per list length.
 */
function cachedOverview(limits?: OverviewLimits) {
  const cache = new Map<PeriodKey, { at: number; value: DashboardOverview }>()
  const computing = createSingleFlight<DashboardOverview>()
  const read = async (scope: MedusaContainer, key: PeriodKey): Promise<DashboardOverview> => {
    const hit = cache.get(key)
    if (hit && Date.now() - hit.at < TTL_MS) {
      return hit.value
    }
    const value = await computing(key, () => computeOverview(scope, key, limits))
    cache.set(key, { at: Date.now(), value })
    return value
  }
  const clear = () => {
    cache.clear()
  }
  return { read, clear }
}

const dashboard = cachedOverview()
// Reports list every product sold (up to a page a person reads) and every category
const report = cachedOverview({ products: 100, categories: 20 })

export const readDashboardOverview = dashboard.read
export const readSalesReport = report.read

/** Tests start from empty caches. */
export function clearDashboardCache(): void {
  dashboard.clear()
  report.clear()
}
