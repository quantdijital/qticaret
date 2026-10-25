import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { AdminGetDashboardOverviewType } from "../validators"
import { readDashboardOverview } from "./read"

/** Sales, orders and best sellers for a period against the one before (no personal data). */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetDashboardOverviewType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readDashboardOverview(req.scope, req.validatedQuery.period))
}
