import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rangeOf } from "../validators"
import type { AdminGetReportRangeType } from "../validators"
import { readStockReport } from "./read"

/**
 * GET /admin/reports/stock (F11.4): stock value from unit costs, turnover
 * over the period, idle stock and what has no cost. Staff only; costs are
 * the shop's own, never shown to a customer.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetReportRangeType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readStockReport(req.scope, rangeOf(req.validatedQuery)))
}
