import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { suggestTextWorkflow } from "../../../../workflows/ai/suggest-text"
import type { AdminGetAiSuggestionsType, AdminPostAiSuggestionType } from "../validators"
import { readOpenAltSuggestions } from "./read"

/**
 * GET /admin/ai/suggestions?task=image_alt_text (docs/22 "Aşama 5"): the
 * suggestions still waiting for a decision, the newest per image, with the
 * image they are for. Read only; the task's roles only.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetAiSuggestionsType>,
  res: MedusaResponse
): Promise<void> {
  res.json({ suggestions: await readOpenAltSuggestions(req.scope, req.auth_context.actor_id) })
}

/**
 * POST /admin/ai/suggestions (adr/0071 §11): a suggestion for a record's
 * field, never written to it here. 201 with the suggestion; a suggestion
 * the gate turned down is 422 `ai.suggestion_refused` with its problems
 * and no text.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAiSuggestionType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await suggestTextWorkflow(req.scope).run({
    input: { ...req.validatedBody, user_id: req.auth_context.actor_id },
  })
  if (result.status === "refused") {
    res.status(422).json({
      type: "invalid_data",
      message: "ai.suggestion_refused",
      problems: result.problems,
      service: result.service,
      alternatives: result.alternatives,
    })
    return
  }
  res.status(201).json({ suggestion: result })
}
