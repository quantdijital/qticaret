import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { rangeOf } from "../validators"
import type { AdminGetReportRangeType } from "../validators"
import { readCustomersReport } from "./read"

/**
 * The panel's customers report (R1): new customers over a preset period or
 * the days asked for against the period before, the share of buyers who
 * had bought before, and the top spenders by name (a recorded read).
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetReportRangeType>,
  res: MedusaResponse
): Promise<void> {
  res.json(await readCustomersReport(req.scope, rangeOf(req.validatedQuery)))
}
