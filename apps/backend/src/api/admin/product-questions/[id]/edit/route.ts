import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { editQuestionWorkflow } from "../../../../../workflows/customers/question-admin"
import type { AdminPostQuestionEditType } from "../../validators"

/**
 * POST /admin/product-questions/:id/edit: the question's words and the
 * shop's own answer (`answer: null` removes it). A path of its own, not
 * `POST /:id`, so `/moderate`'s body is never read as an edit.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostQuestionEditType>,
  res: MedusaResponse
): Promise<void> {
  const { body, answer } = req.validatedBody
  const { result } = await editQuestionWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", body, answer, user_id: req.auth_context.actor_id },
  })
  res.json({ question: result })
}
