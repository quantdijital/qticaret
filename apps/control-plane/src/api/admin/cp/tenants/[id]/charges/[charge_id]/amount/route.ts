import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { chargeAction } from "../../../../../billing/charge-action"
import type { PostChargeAmountType } from "../../../../../billing/validators"

/**
 * POST /admin/cp/tenants/:id/charges/:charge_id/amount (owner, finance,
 * step-up; adr/0061 §7 "kıst hesap yok, gerekirse personel ödeme kaydının
 * tutarını gerekçeyle düzeltir"): an open charge's amount corrected, with
 * the reason; the audit row keeps the amount from and to.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<PostChargeAmountType>,
  res: MedusaResponse
): Promise<void> {
  const { amount, reason } = req.validatedBody
  await chargeAction(req, res, (actor) => ({ kind: "amount", amount, reason, actor }))
}
