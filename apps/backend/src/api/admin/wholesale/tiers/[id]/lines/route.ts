import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { wholesaleContext } from "../../../../../../workflows/wholesale/context"
import { wholesaleLines } from "../../../../../../workflows/wholesale/lines"
import { zeroRateVariants } from "../../../../../../workflows/wholesale/zero-rate"
import type { AdminGetWholesaleLinesType } from "../../../validators"
import { lineView, tierOf } from "../../../view"

/**
 * `GET /admin/wholesale/tiers/:id/lines` (ADR-0068 §4): a page of the
 * level's prices (`limit`, `offset`, `q`), KDV excluded and included,
 * hand-entered or by the rate, each flagged where retail now (a live
 * public sale included) is below it: a warning for the panel, never a
 * block (Ek 2026-11-15). `count` and `undercut_count` cover every page;
 * `rate_zero` names the variants the rate would sell at 0,00, which get
 * no row and keep their retail price.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tier = await tierOf(req)
  const query = req.validatedQuery as unknown as AdminGetWholesaleLinesType
  const { currency } = await wholesaleContext(req.scope)
  const [page, rateZero] = await Promise.all([
    wholesaleLines(req.scope, tier.price_list_id, query),
    zeroRateVariants(req.scope, currency, tier.rate_bps ?? null),
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
