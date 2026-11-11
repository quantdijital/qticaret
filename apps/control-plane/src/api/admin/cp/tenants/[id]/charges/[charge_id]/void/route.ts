import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { chargeAction } from "../../../../../billing/charge-action"
import type { PostChargeReasonType } from "../../../../../billing/validators"

/**
 * POST /admin/cp/tenants/:id/charges/:charge_id/void (owner alone,
 * step-up; Ek C16): an open charge that should never have been made
 * (a duplicate, the wrong shop) voided, with the reason. Unlike a waiver
 * it says nothing was owed; it leaves the shop's status as its other
 * charges give it.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostChargeReasonType>,
  res: MedusaResponse
): Promise<void> {
  const { reason } = req.validatedBody
  await chargeAction(req, res, (actor) => ({ kind: "void", reason, actor }))
}
