import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { wholesaleLines } from "../../../../../../workflows/wholesale/lines"
import type { AdminGetWholesaleLinesType } from "../../../validators"
import { lineView, tierOf } from "../../../view"

/**
 * `GET /admin/wholesale/tiers/:id/lines` (ADR-0068 §4): a page of the
 * level's prices (`limit`, `offset`, `q`), KDV excluded and included,
 * hand-entered or by the rate, each flagged where retail now (a live
 * public sale included) is below it: a warning for the panel, never a
 * block (Ek 2026-11-15). `count` and `undercut_count` cover every page.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tier = await tierOf(req)
  const query = req.validatedQuery as unknown as AdminGetWholesaleLinesType
  const page = await wholesaleLines(req.scope, tier.price_list_id, query)
  res.json({
    lines: page.lines.map(lineView),
    count: page.count,
    undercut_count: page.undercut_count,
    limit: query.limit,
    offset: query.offset,
  })
}
