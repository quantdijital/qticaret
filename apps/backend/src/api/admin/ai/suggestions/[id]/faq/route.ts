import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { acceptFaqWorkflow } from "../../../../../../workflows/ai/accept-faq"
import type { AdminPostAiFaqType } from "../../../validators"

/**
 * POST /admin/ai/suggestions/:id/faq (adr/0074 §5 madde 4): "Seçilenleri
 * ekle" under a product's FAQ draft. The items a person kept, edited or
 * not, are gated again on the server (400 `ai.faq_item_invalid` for one
 * that does not pass), the draft is accepted, and the items are added as
 * the shop's own questions on the product's page, published at once.
 * Owner and admin, as the task; nothing is notified or e-mailed.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAiFaqType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await acceptFaqWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      items: req.validatedBody.items,
      user_id: req.auth_context.actor_id,
    },
  })
  res.status(201).json({ suggestion: result })
}
