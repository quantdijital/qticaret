import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PRODUCT_QA_MODULE } from "../../../../modules/product-qa"
import type ProductQaModuleService from "../../../../modules/product-qa/service"
import type { AdminModerateAnswersType } from "../../product-questions/validators"

/** POST /admin/product-answers/moderate (F10.10): customers' answers approved or rejected. */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminModerateAnswersType>,
  res: MedusaResponse
): Promise<void> {
  const { ids, status } = req.validatedBody
  await req.scope
    .resolve<ProductQaModuleService>(PRODUCT_QA_MODULE)
    .moderateAnswers({ ids, status, by: req.auth_context.actor_id })
  res.json({ moderated: ids.length })
}
