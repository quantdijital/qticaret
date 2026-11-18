import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { readProductCard } from "../../lib/ai/product-card"
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
    }))
  )
  const prompt = taskInputStep(
    transform({ input }, ({ input }) => ({
      task: input.task,
      option: input.option,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      template_id: input.template_id,
    }))
  )
  const claimed = claimQuotaStep(
    transform({ authorized }, ({ authorized }) => ({ capability: authorized.capability }))
  )
  const outcome = callServiceStep(
    transform({ authorized, chosen, prompt }, ({ authorized, chosen, prompt }) => ({
      task: authorized.task,
      capability: authorized.capability,
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
      capability: authorized.capability,
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
      text: outcome.status === "succeeded" ? outcome.text : null,
      // A product card (Aşama 6) also as its fields; its text is the same card as JSON
      ...(findAiTask(input.task)?.gate === "product_card"
        ? { card: outcome.status === "succeeded" ? readProductCard(outcome.text) : null }
        : {}),
      problems: outcome.problems,
      alternatives: chosen.alternatives,
    }))
  )
})
