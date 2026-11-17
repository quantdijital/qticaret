import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { decideSuggestionWorkflow } from "../../../../../../workflows/ai/decide-suggestion"

/**
 * POST /admin/ai/suggestions/:id/accept (adr/0071 §11): records the
 * decision and returns the text; the panel puts it in the form, which
 * saves it as its own change.
 */
export async function POST(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { result } = await decideSuggestionWorkflow(req.scope).run({
    input: { id: req.params["id"] ?? "", decision: "accept", user_id: req.auth_context.actor_id },
  })
  res.json({ suggestion: result })
}
