import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createSingleFlight } from "../../../../lib/cache"
import type { PeriodKey } from "../../../../lib/dashboard"
import { computeOverview } from "../../dashboard/overview/read"
import type { DashboardOverview } from "../../dashboard/overview/read"
import type { AdminGetDashboardOverviewType } from "../../dashboard/validators"

// Reports list every product sold (up to a page a person reads) and every category
const LIMITS = { products: 100, categories: 20 }
const TTL_MS = 60_000
const cache = new Map<PeriodKey, { at: number; value: DashboardOverview }>()
// Requests missing the cache together wait for one computation
const computing = createSingleFlight<DashboardOverview>()

/** The panel's sales report: the dashboard's numbers with full product and category lists (no personal data). */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetDashboardOverviewType>,
  res: MedusaResponse
): Promise<void> {
  const key = req.validatedQuery.period
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) {
    res.json(hit.value)
    return
  }
  const value = await computing(key, () => computeOverview(req.scope, key, LIMITS))
  cache.set(key, { at: Date.now(), value })
  res.json(value)
}
