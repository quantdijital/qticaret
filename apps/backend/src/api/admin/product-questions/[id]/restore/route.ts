import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { restoreQuestionWorkflow } from "../../../../../workflows/customers/question-admin"

/** POST /admin/product-questions/:id/restore: a deleted question back with its answers ("Geri al"). */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await restoreQuestionWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "" },
  })
  res.json({ question: result })
}
