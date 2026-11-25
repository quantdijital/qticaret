import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setDailyCap } from "../../../../../../../lib/ai-credits/staff"
import { noteAuditChanges } from "../../../../../../http/audit"
import { tenantParam } from "../../../../tenants/params"
import type { PostAiDailyCapType } from "../../../../ai/validators"

/**
 * POST /admin/cp/tenants/:id/ai-credits/daily-cap (owner, step-up; adr/0085
 * K7): the shop's own day's cap, or null for the platform's.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostAiDailyCapType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const done = await setDailyCap(req.scope, {
    tenantId: tenant.id,
    cap: req.validatedBody.daily_cap,
    now: new Date(),
  })
  noteAuditChanges(req, { daily_cap: { from: done.before, to: done.after } })
  res.json({ own_daily_cap: done.after })
}
