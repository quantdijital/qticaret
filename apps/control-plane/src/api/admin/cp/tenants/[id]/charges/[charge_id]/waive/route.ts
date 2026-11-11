import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { chargeAction } from "../../../../../billing/charge-action"
import type { PostChargeReasonType } from "../../../../../billing/validators"

/**
 * POST /admin/cp/tenants/:id/charges/:charge_id/waive (owner, finance,
 * step-up; adr/0061 §7 "Bağışla"): an open charge forgiven, with the
 * reason (kept on the charge, not in the audit). As a payment, it returns
 * a shop restricted for it to `active` at once.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostChargeReasonType>,
  res: MedusaResponse
): Promise<void> {
  const { reason } = req.validatedBody
  await chargeAction(req, res, (actor) => ({ kind: "waive", reason, actor }))
}
