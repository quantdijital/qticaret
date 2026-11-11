import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { istanbulDay } from "../../../../../../lib/billing/days"
import { reissuePlanDocuments } from "../../../../../../lib/fleet/reissue"
import { setGraceWorkflow } from "../../../../../../workflows/billing/workflows"
import { noteAuditChanges } from "../../../../../http/audit"
import { subscriptionDetail } from "../../../billing/views"
import type { PostSubscriptionGraceType } from "../../../billing/validators"
import { actorOf, tenantParam } from "../../params"

/**
 * GET /admin/cp/tenants/:id/subscription (all staff; Ek C16): the shop's
 * subscription, charges and reminders. Amounts and days only: no
 * personal data, so the read is not recorded.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const tenant = await tenantParam(req)
  res.setHeader("Cache-Control", "no-store")
  res.json(await subscriptionDetail(req, tenant.id))
}

/**
 * POST /admin/cp/tenants/:id/subscription (owner, finance, step-up; Ek
 * C16): the shop's own grace days with the reason, or `null` for the
 * package's again (adr/0061 §7 "mağaza istisnasıyla"). It may restrict or
 * free the shop at once; its plan document follows.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostSubscriptionGraceType>,
  res: MedusaResponse
): Promise<void> {
  const tenant = await tenantParam(req)
  const { grace_days, reason } = req.validatedBody
  const { result } = await setGraceWorkflow(req.scope).run({
    input: {
      tenant_id: tenant.id,
      today: istanbulDay(new Date()),
      days: grace_days,
      reason: reason ?? null,
      actor: actorOf(req),
    },
  })
  noteAuditChanges(req, {
    grace_days_override: { from: result.before.grace_days_override, to: grace_days },
    ...(result.move.moved ? { tenant_status: { from: result.move.from, to: result.move.to } } : {}),
  })
  await reissuePlanDocuments(req.scope, [tenant.id])
  res.json(await subscriptionDetail(req, tenant.id))
}
