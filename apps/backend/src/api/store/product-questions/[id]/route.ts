import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { questionPage } from "../../../../workflows/customers/questions"

/**
 * GET /store/product-questions/:id (F10.10): one approved question's own
 * page, with its QAPage block once it has an answer.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const page = await questionPage(req.scope, req.params["id"] ?? "")
  if (!page) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "questions.unknown")
  }
  res.json(page)
}
