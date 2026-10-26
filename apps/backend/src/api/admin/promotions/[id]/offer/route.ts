import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { updateOfferWorkflow } from "../../../../../workflows/promotions/update-offer"
import type { AdminPostPromotionOfferType } from "./validators"

/**
 * `POST /admin/promotions/:id/offer` (F4.4/F4.5): what the panel's form
 * changed in a promotion, saved whole or not at all.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostPromotionOfferType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await updateOfferWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", ...req.validatedBody },
  })
  res.json({ promotion: result })
}
