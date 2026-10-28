import type {
  AuthenticatedMedusaRequest,
  MedusaRequest,
  MedusaResponse,
} from "@medusajs/framework/http"
import { askQuestion, productQuestions } from "../../../../../workflows/customers/questions"
import type {
  StoreGetQuestionsType,
  StorePostQaTextType,
} from "../../../../admin/product-questions/validators"

/** GET /store/products/:id/questions (F10.10): approved questions with their approved answers. */
export async function GET(
  req: MedusaRequest<unknown, StoreGetQuestionsType>,
  res: MedusaResponse
): Promise<void> {
  const { offset, limit } = req.validatedQuery
  res.json({
    ...(await productQuestions(req.scope, req.params["id"] ?? "", { offset, limit })),
    offset,
    limit,
  })
}

/** POST /store/products/:id/questions: a signed-in customer asks; it waits for the shop. */
export async function POST(
  req: AuthenticatedMedusaRequest<StorePostQaTextType>,
  res: MedusaResponse
): Promise<void> {
  const { id } = await askQuestion(req.scope, {
    customer_id: req.auth_context.actor_id,
    product_id: req.params["id"] ?? "",
    body: req.validatedBody.body,
  })
  res.status(201).json({ question: { id, status: "pending" } })
}
