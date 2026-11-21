import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { readAttributeSuggestions } from "../../lib/ai/product-attributes"
import { readProductCard } from "../../lib/ai/product-card"
import { readFaqSuggestions } from "../../lib/ai/product-faq"
import { readPostDraft } from "../../lib/ai/post-draft"
import { isPickTask, readProductPicks } from "../../lib/ai/product-picks"
import { findAiTask } from "../../lib/ai/registry/tasks"
import { authorizeTaskStep } from "./steps/authorize-task"
import { callServiceStep } from "./steps/call-service"
import { claimQuotaStep, releaseUntakenStep } from "./steps/claim-quota"
import { failOnCallErrorStep, linkUsageSuggestionStep, recordUsageStep } from "./steps/record-usage"
import { saveSuggestionStep } from "./steps/save-suggestion"
import { selectServiceStep } from "./steps/select-service"
import { taskInputStep } from "./steps/task-input"
import type { AiEntityType } from "./steps/task-input"

export interface SuggestTextInput {
  task: string
  entity_type: AiEntityType
  entity_id: string
  service?: string | null | undefined
  option?: string | null | undefined
  /** A product card's template (Aşama 6): its attributes are the only ones the card may fill. */
  template_id?: string | null | undefined
  user_id: string
}

/**
 * A text suggestion for a record (adr/0071 §8): authorised, a service
 * chosen, the record read on the server, the call counted, made and
 * gated (the claim given back only when the service never took the job),
 * the attempt recorded (before the suggestion and never undone, so a
 * failing suggestion step leaves the paid call's row; the suggestion's
 * id is linked to it afterwards) and the suggestion kept for a decision.
 * Nothing reaches the record here: "Kullan" fills the panel's form.
 *
 * Neither `store` nor a retention may be turned on: the steps carry no
 * key, but the prompt's data needs no second copy in `workflow_execution`.
 */
export const suggestTextWorkflow = createWorkflow("ai-suggest-text", (input: SuggestTextInput) => {
  const authorized = authorizeTaskStep(
    transform({ input }, ({ input }) => ({
      task: input.task,
      option: input.option,
      user_id: input.user_id,
    }))
  )
  const chosen = selectServiceStep(
    transform({ input }, ({ input }) => ({
      task: input.task,
      user_id: input.user_id,
      service: input.service,
      // A `photo` task (a product's attributes) reads the product's picture where the service sees
      entity_type: input.entity_type,
      entity_id: input.entity_id,
    }))
  )
  const prompt = taskInputStep(
    transform({ input, chosen }, ({ input, chosen }) => ({
      task: input.task,
      option: input.option,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      template_id: input.template_id,
      image_file_id: chosen.image_file_id,
    }))
  )
  // The call's capability is the chosen service's way of running it: `vision` with a picture
  const claimed = claimQuotaStep(
    transform({ chosen }, ({ chosen }) => ({ capability: chosen.capability }))
  )
  const outcome = callServiceStep(
    transform({ authorized, chosen, prompt }, ({ authorized, chosen, prompt }) => ({
      task: authorized.task,
      capability: chosen.capability,
      service: chosen.service,
      system: prompt.system,
      data: prompt.data,
      image_file_id: prompt.image_file_id,
      allowed: prompt.allowed,
    }))
  )
  // Straight after the call: a later failure neither skips it nor undoes a call the service did
  releaseUntakenStep(
    transform({ claimed, outcome }, ({ claimed, outcome }) => ({ claimed, outcome }))
  )
  // Before the suggestion, with no undo: a failing suggestion step cannot roll back a paid call's row
  const usage = recordUsageStep(
    transform({ input, authorized, chosen, outcome }, ({ input, authorized, chosen, outcome }) => ({
      task: authorized.task,
      capability: chosen.capability,
      service: chosen.service,
      funding: chosen.funding,
      outcome,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      suggestion_id: null,
      user_id: input.user_id,
      remember: chosen.remember,
    }))
  )
  const suggestion = saveSuggestionStep(
    transform({ input, chosen, prompt, outcome }, ({ input, chosen, prompt, outcome }) => ({
      task: input.task,
      service: chosen.service,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      system: prompt.system,
      data: prompt.data,
      outcome,
      user_id: input.user_id,
    }))
  )
  linkUsageSuggestionStep(
    transform({ usage, suggestion }, ({ usage, suggestion }) => ({
      usage_id: usage.usage_id,
      usage_ids: usage.usage_ids,
      suggestion_id: suggestion.id,
    }))
  )
  failOnCallErrorStep(
    transform({ chosen, outcome }, ({ chosen, outcome }) => ({
      service: chosen.service,
      outcome,
      alternatives: chosen.alternatives,
    }))
  )
  return new WorkflowResponse(
    transform({ input, chosen, outcome, suggestion }, ({ input, chosen, outcome, suggestion }) => ({
      id: suggestion.id,
      task: input.task,
      service: chosen.service,
      status: outcome.status === "succeeded" ? ("draft" as const) : ("refused" as const),
      // The first candidate, as before candidates (adr/0074 §4); the panel offers them all
      text: outcome.status === "succeeded" ? outcome.text : null,
      candidates: outcome.status === "succeeded" ? outcome.candidates : [],
      // A product card (Aşama 6) also as its fields; its text is the same card as JSON
      ...(findAiTask(input.task)?.gate === "product_card"
        ? { card: outcome.status === "succeeded" ? readProductCard(outcome.text) : null }
        : {}),
      // A pick (a product's tags or categories) also as its records; its text is the same as JSON
      ...(isPickTask(findAiTask(input.task) ?? { gate: "plain_text" })
        ? { picks: outcome.status === "succeeded" ? readProductPicks(outcome.text) : null }
        : {}),
      // Values for the empty attributes, by key; its text is the same as JSON
      ...(findAiTask(input.task)?.gate === "product_attributes"
        ? {
            attributes:
              outcome.status === "succeeded" ? readAttributeSuggestions(outcome.text) : null,
          }
        : {}),
      // A product's FAQ items, in order; its text is the same as JSON
      ...(findAiTask(input.task)?.gate === "product_faq"
        ? { faq: outcome.status === "succeeded" ? readFaqSuggestions(outcome.text) : null }
        : {}),
      // A blog post draft: its sections and the links apart; its text is the same as JSON
      ...(findAiTask(input.task)?.gate === "post_draft"
        ? { draft: outcome.status === "succeeded" ? readPostDraft(outcome.text) : null }
        : {}),
      problems: outcome.problems,
      alternatives: chosen.alternatives,
    }))
  )
})
