import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { answerAsCustomer } from "../../../../../workflows/customers/questions"
import type { StorePostQaTextType } from "../../../../admin/product-questions/validators"

/** POST /store/product-questions/:id/answers: a customer who received the product answers. */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostQaTextType>,
  res: MedusaResponse
): Promise<void> {
  const { id } = await answerAsCustomer(req.scope, {
    customer_id: req.auth_context.actor_id,
    question_id: req.params["id"] ?? "",
    body: req.validatedBody.body,
  })
  res.status(201).json({ answer: { id, status: "pending" } })
}
