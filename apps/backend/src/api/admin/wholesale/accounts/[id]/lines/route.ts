import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { wholesaleContext } from "../../../../../../workflows/wholesale/context"
import { wholesaleLines } from "../../../../../../workflows/wholesale/lines"
import { zeroRateVariants } from "../../../../../../workflows/wholesale/zero-rate"
import { ownListOf } from "../../../account-view"
import type { AdminGetWholesaleLinesType } from "../../../validators"
import { lineView } from "../../../view"

/**
 * `GET /admin/wholesale/accounts/:id/lines` (ADR-0068 §4): a page of the
 * wholesaler's own prices, as a level's lines read (`limit`, `offset`,
 * `q`; the retail warning, never a block). 409 without an own list.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const list = await ownListOf(req)
  const query = req.validatedQuery as unknown as AdminGetWholesaleLinesType
  const { currency } = await wholesaleContext(req.scope)
  const [page, rateZero] = await Promise.all([
    wholesaleLines(req.scope, list.price_list_id, query),
    zeroRateVariants(req.scope, currency, list.rate_bps),
  ])
  res.json({
    lines: page.lines.map(lineView),
    count: page.count,
    undercut_count: page.undercut_count,
    rate_zero: rateZero,
    limit: query.limit,
    offset: query.offset,
  })
}
