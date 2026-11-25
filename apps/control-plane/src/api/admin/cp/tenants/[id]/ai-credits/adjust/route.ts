import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { adjust } from "../../../../../../../lib/ai-credits/grant"
import { noteAuditChanges } from "../../../../../../http/audit"
import { actorOf, tenantParam } from "../../../../tenants/params"
import type { PostAiAdjustType } from "../../../../ai/validators"

/**
 * POST /admin/cp/tenants/:id/ai-credits/adjust (owner, step-up; adr/0085
 * "Güvenlik"): credits added to or taken from one bucket, with a note and
 * the form's one key (`key`): sent again it changes nothing and answers
 * `applied: false`. A balance never goes below 0
 * (`cp.ai_credit_balance_short`). The correction writes its own audit row
 * too; this one keeps the amount and bucket, never the note's text.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostAiAdjustType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { amount, bucket, note, key } = req.validatedBody
  const done = await adjust(req.scope, {
    tenantId: tenant.id,
    key,
    amount,
    bucket,
    note,
    actor: actorOf(req),
    now: new Date(),
  })
  noteAuditChanges(req, { adjust: { bucket, amount, applied: done.applied } })
  res.json({ applied: done.applied, entry_id: done.entryId, balance: done.balance })
}
