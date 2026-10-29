import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readSalesReport } from "../../dashboard/overview/read"
import { rangeOf } from "../validators"
import type { AdminGetReportRangeType } from "../validators"

/**
 * The panel's sales report (F11.1–F11.2): the dashboard's numbers over a
 * preset period or the days asked for, with full product and category
 * lists (no personal data).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetReportRangeType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readSalesReport(req.scope, rangeOf(req.validatedQuery)))
}
