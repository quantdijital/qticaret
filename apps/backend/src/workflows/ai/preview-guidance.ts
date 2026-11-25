import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import type { AiGuidanceSettings } from "../../modules/platform-settings/sections/ai-guidance"
import { authorizeTaskStep } from "./steps/authorize-task"
import { callServiceStep } from "./steps/call-service"
import type { CallOutcome } from "./steps/call-service"
import { claimQuotaStep, releaseUntakenStep } from "./steps/claim-quota"
import { failOnCallErrorStep, recordUsageStep } from "./steps/record-usage"
import { selectServiceStep } from "./steps/select-service"
import { taskInputStep } from "./steps/task-input"
import type { GuidanceSource } from "./steps/task-input"

export interface PreviewGuidanceInput {
  task: string
  product_id: string
  service?: string | null | undefined
  /** The guidance as the settings form holds it, held by the section's schema (not saved). */
  guidance: AiGuidanceSettings
  user_id: string
}

/** One side of the comparison, as the panel shows it; nothing of it is kept. */
export interface PreviewSide {
  status: "succeeded" | "refused"
  candidates: string[]
  problems: string[]
}

const sideOf = (outcome: CallOutcome): PreviewSide => ({
  status: outcome.status === "succeeded" ? "succeeded" : "refused",
  candidates: outcome.status === "succeeded" ? outcome.candidates : [],
  problems: outcome.problems,
})

/** Which guidance a side is built with: none, or the form's (adr/0074 §2). */
const guidanceSourceOf = (
  name: "plain" | "guided",
  settings: AiGuidanceSettings
): GuidanceSource => (name === "plain" ? { use: "none" } : { use: "given", settings })

type Chosen = ReturnType<typeof selectServiceStep>
type Authorized = ReturnType<typeof authorizeTaskStep>

/**
 * One call of the two: the task's messages with this guidance, the call
 * claimed against the day's ceiling and the month's operations like any
 * suggestion's, made, given back only when the service never took it,
 * and recorded in `ai_usage` (it was paid for). No suggestion is kept.
 */
function previewCall(
  name: "plain" | "guided",
  input: PreviewGuidanceInput,
  authorized: Authorized,
  chosen: Chosen
) {
  const prompt = taskInputStep(
    transform({ input }, ({ input }) => ({
      task: input.task,
      entity_type: "product" as const,
      entity_id: input.product_id,
      guidance: guidanceSourceOf(name, input.guidance),
    }))
  ).config({ name: `ai-preview-input-${name}` })
  const claimed = claimQuotaStep(
    transform({ authorized, chosen }, ({ authorized, chosen }) => ({
      capability: authorized.capability,
      funding: chosen.funding,
    }))
  ).config({ name: `ai-preview-claim-${name}` })
  const outcome = callServiceStep(
    transform({ authorized, chosen, prompt }, ({ authorized, chosen, prompt }) => ({
      task: authorized.task,
      capability: authorized.capability,
      service: chosen.service,
      system: prompt.system,
      data: prompt.data,
      // Each side is its own operation (two answers shown): the step makes one for it
      operation: null,
    }))
  ).config({ name: `ai-preview-call-${name}` })
  releaseUntakenStep(
    transform({ claimed, outcome }, ({ claimed, outcome }) => ({ claimed, outcome }))
  ).config({ name: `ai-preview-release-${name}` })
  recordUsageStep(
    transform({ input, authorized, chosen, outcome }, ({ input, authorized, chosen, outcome }) => ({
      task: authorized.task,
      capability: authorized.capability,
      service: chosen.service,
      funding: chosen.funding,
      outcome,
      entity_type: "product",
      entity_id: input.product_id,
      suggestion_id: null,
      user_id: input.user_id,
      remember: false,
    }))
  ).config({ name: `ai-preview-usage-${name}` })
  return outcome
}

/**
 * "Dene" on the writing guidance page (adr/0074 §2): the same product and
 * task asked twice, without the shop's guidance and with the guidance as
 * the form holds it, so the shop sees what its setting changes before it
 * saves it. Authorised as the task (and the route lets owner and admin
 * only); each call counts as a suggestion would (the day's ceiling and
 * the month's operations), is recorded in `ai_usage` and passes the gate.
 * Neither answer is kept as a suggestion nor written to the product. A
 * call the service failed fails the workflow once it is recorded; when it
 * is the first, the second is never made.
 */
export const previewGuidanceWorkflow = createWorkflow(
  "ai-preview-guidance",
  (input: PreviewGuidanceInput) => {
    const authorized = authorizeTaskStep(
      transform({ input }, ({ input }) => ({ task: input.task, user_id: input.user_id }))
    )
    const chosen = selectServiceStep(
      transform({ input }, ({ input }) => ({
        task: input.task,
        user_id: input.user_id,
        service: input.service,
      }))
    )
    const failOn = (name: "plain" | "guided", outcome: ReturnType<typeof previewCall>) =>
      failOnCallErrorStep(
        transform({ chosen, outcome }, ({ chosen, outcome }) => ({
          service: chosen.service,
          outcome,
          alternatives: chosen.alternatives,
        }))
      ).config({ name: `ai-preview-fail-${name}` })
    // Steps run in the order composed: a first call the service failed
    // (recorded above) stops the workflow before the second is made.
    const plain = previewCall("plain", input, authorized, chosen)
    failOn("plain", plain)
    const guided = previewCall("guided", input, authorized, chosen)
    failOn("guided", guided)
    return new WorkflowResponse(
      transform({ input, chosen, plain, guided }, ({ input, chosen, plain, guided }) => ({
        task: input.task,
        service: chosen.service,
        plain: sideOf(plain),
        guided: sideOf(guided),
        alternatives: chosen.alternatives,
      }))
    )
  }
)
