import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { wholesaleLines } from "../../../../../../workflows/wholesale/lines"
import { lineView, tierOf } from "../../../view"

/**
 * `GET /admin/wholesale/tiers/:id/lines` (ADR-0068 §4): the level's
 * prices, KDV excluded and included, hand-entered or by the rate, each
 * flagged where retail now (a live public sale included) is below it:
 * a warning for the panel, never a block (Ek 2026-11-15).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tier = await tierOf(req)
  const { lines, undercut_count } = await wholesaleLines(req.scope, tier.price_list_id)
  res.json({ lines: lines.map(lineView), undercut_count })
}
