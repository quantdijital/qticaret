import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { decideSuggestionWorkflow } from "../../../../../../workflows/ai/decide-suggestion"

/** POST /admin/ai/suggestions/:id/dismiss (adr/0071 §11): the staff member let it go. */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await decideSuggestionWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", decision: "dismiss", user_id: req.auth_context.actor_id },
  })
  res.json({ suggestion: result })
}
