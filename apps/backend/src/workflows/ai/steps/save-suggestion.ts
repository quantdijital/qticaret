import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_DRAFTS_MODULE } from "../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../modules/content-drafts/service"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import type { CallOutcome } from "./call-service"

/** Marks a suggestion of the AI core apart from adr/0005's drafts in the same table. */
export const AI_SUGGESTION_SOURCE = "ai_suggestion"

export interface SaveSuggestionInput {
  task: string
  service: string
  entity_type: string
  entity_id: string
  system: string
  data: string
  outcome: CallOutcome
  user_id: string
}

/**
 * Keeps a text suggestion as a `content_draft` (adr/0071 §5): the gated
 * text waiting for a decision, or a refused one with its problems and no
 * text (it is never offered, and a refused text may hold what the gate
 * caught). The prompt is kept as it left: the instruction and the
 * filtered data. `provider` is the service's id. A failed call keeps
 * nothing here. Undone by deleting it.
 */
export const saveSuggestionStep = createStep(
  "ai-save-suggestion",
  async (input: SaveSuggestionInput, { container }) => {
    const { outcome } = input
    if (outcome.status !== "succeeded" && outcome.status !== "refused") {
      return new StepResponse({ id: null as string | null }, null)
    }
    const drafts = container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    const refused = outcome.status === "refused"
    // Customers' words are not copied here (adr/0071 §10): the instruction only, the data left out
    const keepData = findAiTask(input.task)?.keepData !== false
    const draft = await drafts.createContentDrafts({
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      kind: input.task,
      // Candidates (adr/0074 §4) kept as offered, one per line; each is a single line
      text: refused
        ? ""
        : outcome.candidates.length > 1
          ? outcome.candidates.join("\n")
          : (outcome.text ?? ""),
      prompt: keepData ? `${input.system}\n\n${input.data}` : input.system,
      provider: input.service,
      source: AI_SUGGESTION_SOURCE,
      status: refused ? "refused" : "draft",
      problems: refused ? { problems: outcome.problems } : null,
      created_by: input.user_id,
    })
    return new StepResponse({ id: draft.id }, draft.id)
  },
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
        .deleteContentDrafts(id)
    }
  }
)
