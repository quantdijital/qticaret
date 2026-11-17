import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { authorizeTaskStep } from "./steps/authorize-task"
import { callServiceStep } from "./steps/call-service"
import { claimQuotaStep, releaseUntakenStep } from "./steps/claim-quota"
import { failOnCallErrorStep, recordUsageStep } from "./steps/record-usage"
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
  user_id: string
}

/**
 * A text suggestion for a record (adr/0071 §8): authorised, a service
 * chosen, the record read on the server, the call counted, made and
 * gated (the claim given back only when the service never took the job),
 * the suggestion kept for a decision and the attempt recorded.
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
    }))
  )
  // Straight after the call: a later failure neither skips it nor undoes a call the service did
  releaseUntakenStep(
    transform({ claimed, outcome }, ({ claimed, outcome }) => ({ claimed, outcome }))
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
  recordUsageStep(
    transform(
      { input, authorized, chosen, outcome, suggestion },
      ({ input, authorized, chosen, outcome, suggestion }) => ({
        task: authorized.task,
        capability: authorized.capability,
        service: chosen.service,
        funding: chosen.funding,
        outcome,
        entity_type: input.entity_type,
        entity_id: input.entity_id,
        suggestion_id: suggestion.id,
        user_id: input.user_id,
        remember: chosen.remember,
      })
    )
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
      problems: outcome.problems,
      alternatives: chosen.alternatives,
    }))
  )
})
