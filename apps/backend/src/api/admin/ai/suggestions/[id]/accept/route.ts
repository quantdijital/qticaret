import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { decideSuggestionWorkflow } from "../../../../../../workflows/ai/decide-suggestion"
import type { AdminPostAiAcceptType } from "../../../validators"

/**
 * POST /admin/ai/suggestions/:id/accept (adr/0071 §11, adr/0074 §4):
 * records the decision and the candidate taken (`candidate_index`, the
 * first when left out; 400 `ai.candidate_unknown` for one never offered)
 * and returns that candidate's text; the panel puts it in the form, which
 * saves it as its own change.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAiAcceptType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await decideSuggestionWorkflow(req.scope).run({
    input: {
      id: req.params["id"] ?? "",
      decision: "accept",
      candidate_index: req.validatedBody.candidate_index,
      user_id: req.auth_context.actor_id,
    },
  })
  res.json({ suggestion: result })
}
