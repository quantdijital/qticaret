import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { ageCheck, declareAgeWorkflow } from "../../../../../workflows/legal/age"
import type { StorePostAgeDeclarationType } from "./validators"

/**
 * GET /store/carts/:id/age-declaration (F13.3): whether the checkout asks
 * the buyer's age (a restricted product, the shop checking), the shop's
 * limit, and whether the buyer declared it.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.json({ age_check: await ageCheck(req.scope, req.params["id"] ?? "") })
}

/**
 * POST /store/carts/:id/age-declaration: the buyer declares their age. The
 * date of birth is checked and dropped; under the limit nothing is kept
 * and the cart cannot be paid for.
 */
export async function POST(
  req: MedusaStoreRequest<StorePostAgeDeclarationType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await declareAgeWorkflow(req.scope).run({
    input: {
      cart_id: req.params["id"] ?? "",
      sales_channel_ids: req.publishable_key_context.sales_channel_ids,
      birth_date: req.validatedBody.birth_date,
    },
  })
  res.json({ age_declaration: result })
}
