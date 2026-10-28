import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_QA_MODULE } from "../../../../modules/product-qa"
import type ProductQaModuleService from "../../../../modules/product-qa/service"
import type { AdminModerateQuestionsType } from "../validators"

/** POST /admin/product-questions/moderate (F10.10): questions approved or rejected at once. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminModerateQuestionsType>,
  res: MedusaResponse
): Promise<void> {
  const { ids, status } = req.validatedBody
  await req.scope
    .resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
    .moderateQuestions({ ids, status, by: req.auth_context.actor_id })
  res.json({ moderated: ids.length })
}
