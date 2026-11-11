import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { addDays, istanbulDay } from "../../../../../../../../lib/billing/days"
import { billingIn } from "../../../../../../../../workflows/modules"
import { paramOf, tenantParam } from "../../../../params"
import { chargeAction } from "../../../../../billing/charge-action"
import type { PostChargePayType } from "../../../../../billing/validators"

/** How long before its period a payment may have arrived (paid ahead, review). */
const PAID_EARLIEST_DAYS = 60

/**
 * POST /admin/cp/tenants/:id/charges/:charge_id/pay (owner, finance,
 * step-up; adr/0061 §7 "Ödendi"): an open charge marked paid with the day
 * the money arrived (not after today, Istanbul, nor more than 60 days
 * before the period it pays for), the method and the
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
  // Review: nor long before the period it pays for (a mistyped year)
  const charge = await billingIn(req.scope).chargeOf(
    (await tenantParam(req)).id,
    paramOf(req, "charge_id")
  )
  if (paid_on < addDays(charge.period_start, -PAID_EARLIEST_DAYS)) {
    res.status(400).json({ type: "invalid_data", message: "cp.paid_on_too_early" })
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
