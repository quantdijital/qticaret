import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { turkishDay } from "../../../../lib/dashboard"
import { SEARCH_TERMS_MODULE } from "../../../../modules/search-terms"
import type SearchTermsModuleService from "../../../../modules/search-terms/service"
import { windowOf } from "../../dashboard/overview/read"
import { rangeOf } from "../validators"
import type { AdminGetReportRangeType } from "../validators"

// Terms a list shows
const LISTED = 50

/**
 * GET /admin/reports/search (F11.8): the period's storefront searches,
 * the most searched terms and the ones that found nothing. Counts only.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetReportRangeType>,
  res: MedusaResponse
): Promise<void> {
  const window = windowOf(rangeOf(req.validatedQuery))
  const from = turkishDay(window.from)
  const to = turkishDay(new Date(window.to.getTime() - 1))
  const terms = req.scope.resolve<SearchTermsModuleService>(SEARCH_TERMS_MODULE)
  const [totals, top, zero] = await Promise.all([
    terms.totals(from, to),
    terms.ranked(from, to, { limit: LISTED }),
    terms.ranked(from, to, { limit: LISTED, zeroOnly: true }),
  ])
  res.json({
    period: { key: window.key, from: window.from.toISOString(), to: window.to.toISOString() },
    totals,
    top,
    zero,
  })
}
