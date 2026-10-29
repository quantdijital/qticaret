import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { saveMerchantAccountWorkflow } from "../../../../workflows/google/merchant"
import type { AdminPostGoogleMerchantType } from "../validators"

/** POST /admin/google/merchant: the shop's Merchant Center account, checked with Google first. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostGoogleMerchantType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await saveMerchantAccountWorkflow(req.scope).run({
    input: { merchant_id: req.validatedBody.merchant_id, user_id: req.auth_context.actor_id },
  })
  res.json(result)
}
