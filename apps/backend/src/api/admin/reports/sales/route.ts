import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readSalesReport } from "../../dashboard/overview/read"
import type { AdminGetDashboardOverviewType } from "../../dashboard/validators"

/** The panel's sales report: the dashboard's numbers with full product and category lists (no personal data). */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetDashboardOverviewType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readSalesReport(req.scope, req.validatedQuery.period))
}
