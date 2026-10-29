import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rangeOf } from "../validators"
import type { AdminGetReportRangeType } from "../validators"
import { readFinanceReport } from "./read"

/**
 * GET /admin/reports/finance (F11.3): sales by VAT rate, collections by
 * payment method and the period's disputes, over a preset period or the
 * days asked for. Staff only; no personal data.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetReportRangeType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readFinanceReport(req.scope, rangeOf(req.validatedQuery)))
}
