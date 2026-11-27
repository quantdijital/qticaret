import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { removeQuestionWorkflow } from "../../../../workflows/customers/question-admin"

/**
 * DELETE /admin/product-questions/:id: the question taken off with its
 * answers (owner and admin); `POST .../restore` brings them back.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await removeQuestionWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "" },
  })
  res.json({ id: result.id, object: "product_question", deleted: true })
}
