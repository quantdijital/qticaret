import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { istanbulDay } from "../../../../../../../../lib/billing/days"
import { chargeAction } from "../../../../../billing/charge-action"
import type { PostChargePayType } from "../../../../../billing/validators"

/**
 * POST /admin/cp/tenants/:id/charges/:charge_id/pay (owner, finance,
 * step-up; adr/0061 §7 "Ödendi"): an open charge marked paid with the day
 * the money arrived (not after today, Istanbul), the method and the
 * receipt's reference. A shop restricted for it is active again at once
 * and hears so in a new plan document.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostChargePayType>,
  res: MedusaResponse
): Promise<void> {
  const { paid_on, method, reference } = req.validatedBody
  if (paid_on > istanbulDay(new Date())) {
    res.status(400).json({ type: "invalid_data", message: "cp.paid_on_future" })
    return
  }
  await chargeAction(req, res, (actor) => ({
    kind: "pay",
    paid_on,
    method,
    reference: reference ?? null,
    actor,
  }))
}
