import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTENT_DRAFTS_MODULE } from "../../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../../modules/content-drafts/service"
import { AI_SUGGESTION_SOURCE } from "../../../../workflows/ai/steps/save-suggestion"

/** The period the rate is read over, in days. */
const ACCEPTANCE_DAYS = 30

/**
 * GET /admin/ai/acceptance (adr/0074 §4 "Ölçüm"): by task, the AI core's
 * suggestions of the last 30 days that were offered (not refused by the
 * gate) and accepted, and the rate (null with none offered). Counts only.
 * Owner and admin, as the usage (`permission-rules.ts`).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const since = new Date(Date.now() - ACCEPTANCE_DAYS * 24 * 60 * 60 * 1000)
  const rows = await req.scope
    .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    .decisionsSince(AI_SUGGESTION_SOURCE, since)
  res.json({
    days: ACCEPTANCE_DAYS,
    tasks: rows.map((row) => ({
      task: row.kind,
      offered: row.offered,
      accepted: row.accepted,
      rate: row.offered > 0 ? row.accepted / row.offered : null,
    })),
  })
}
