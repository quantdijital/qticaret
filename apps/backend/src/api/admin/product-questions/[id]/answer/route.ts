import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_QA_MODULE } from "../../../../../modules/product-qa"
import type ProductQaModuleService from "../../../../../modules/product-qa/service"
import { brandOf } from "../../../../../workflows/messaging/brand"
import type { StorePostQaTextType } from "../../validators"

/**
 * POST /admin/product-questions/:id/answer (F10.10): the shop answers in
 * its own name; the answer shows at once, and the question with it.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostQaTextType>,
  res: MedusaResponse
): Promise<void> {
  const { shopName } = await brandOf(req.scope)
  const { id } = await req.scope.resolve<ProductQaModuleService>(PRODUCT_QA_MODULE).answerAsShop({
    question_id: req.params["id"] ?? "",
    user_id: req.auth_context.actor_id,
    author_name: shopName,
    body: req.validatedBody.body,
  })
  res.status(201).json({ answer: { id, status: "approved" } })
}
