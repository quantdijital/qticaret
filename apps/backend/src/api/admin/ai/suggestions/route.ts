import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { requestImageEditWorkflow } from "../../../../workflows/ai/request-image-edit"
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
 * and no text. Several pictures (`entity_ids`, Aşama 4) are a job: 202
 * with its id; its results are suggestions too, decided one by one. A
 * scene (`image_scene`, Aşama 7) is such a job over one picture.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostAiSuggestionType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  if ("entity_ids" in body) {
    const { result: job } = await requestImageEditWorkflow(req.scope).run({
      input: {
        task: body.task,
        // A scene typed for this once (`image_scene`), held in the workflow
        ...("prompt" in body ? { custom: body.prompt } : { option: body.option }),
        media_ids: body.entity_ids,
        service: body.service,
        user_id: req.auth_context.actor_id,
      },
    })
    res.status(202).json(job)
    return
  }
  const { result } = await suggestTextWorkflow(req.scope).run({
    input: { ...body, user_id: req.auth_context.actor_id },
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
