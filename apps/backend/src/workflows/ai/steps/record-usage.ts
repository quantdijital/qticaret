import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { estimateCost } from "../../../lib/ai/cost"
import { aiProviderError } from "../../../lib/ai/errors"
import type { AiCapability } from "../../../lib/ai/registry/capabilities"
import { findAiService } from "../../../lib/ai/registry/services"
import type { AiFunding, AiUnitPrice } from "../../../lib/ai/registry/services"
import { logger } from "../../../lib/logging"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import type { CallOutcome } from "./call-service"

export interface RecordUsageInput {
  task: string
  capability: AiCapability
  service: string
  funding: AiFunding
  outcome: CallOutcome
  entity_type: string
  entity_id: string
  suggestion_id: string | null
  user_id: string
  /** The staff member picked the service among several: remember it (adr/0071 §4). */
  remember: boolean
  /** The registry's own price for this call where it is not the capability's (a scene). */
  unit_price?: AiUnitPrice | null | undefined
}

/**
 * Writes the attempt's `ai_usage` row whatever its end (adr/0071 §8.7),
 * with the registry's cost estimate, and the `ai.call` log line (§14):
 * counts and codes only, never the prompt, the output or the key. A
 * service that answered and was picked from several is remembered for
 * the task. Not undone: an attempt made stays recorded, failed ones too,
 * and when a later step fails the workflow's rollback leaves the row.
 */
export const recordUsageStep = createStep(
  "ai-record-usage",
  async (input: RecordUsageInput, { container }) => {
    const { outcome } = input
    const service = findAiService(input.service)
    const cost = service
      ? estimateCost(
          service,
          input.capability,
          {
            ...(outcome.input_tokens === null ? {} : { inputTokens: outcome.input_tokens }),
            ...(outcome.output_tokens === null ? {} : { outputTokens: outcome.output_tokens }),
            // Pictures sent (vision, token priced) or given back (an image edit, priced by the image)
            ...(outcome.images === null ? {} : { images: outcome.images }),
          },
          input.unit_price ?? undefined
        )
      : null
    const ai = container.resolve<AiModuleService>(AI_MODULE)
    const id = await ai.recordUsage({
      task: input.task,
      capability: input.capability,
      service: input.service,
      model: outcome.model,
      funding: input.funding,
      status: outcome.status,
      input_tokens: outcome.input_tokens,
      output_tokens: outcome.output_tokens,
      images: outcome.images,
      estimated_cost_micros: cost?.micros ?? null,
      currency: cost?.currency ?? null,
      entity_type: input.entity_type,
      entity_id: input.entity_id,
      suggestion_id: input.suggestion_id,
      duration_ms: outcome.duration_ms,
      error_code: outcome.error_code,
      requested_by: input.user_id,
    })
    const answered = outcome.status === "succeeded" || outcome.status === "refused"
    if (input.remember && answered) {
      await ai.rememberChoice({ user_id: input.user_id, task: input.task, service: input.service })
    }
    logger.info({
      event: "ai.call",
      task: input.task,
      capability: input.capability,
      service: input.service,
      funding: input.funding,
      status: outcome.status,
      duration_ms: outcome.duration_ms,
      input_tokens: outcome.input_tokens,
      output_tokens: outcome.output_tokens,
      images: outcome.images,
      error_code: outcome.error_code,
    })
    return new StepResponse({ usage_id: id })
  }
)

/**
 * Names the suggestion on a usage row written before it (an image edit
 * records its attempt straight after the paid call, so a failing
 * suggestion cannot undo the row). The row is updated, never written
 * again; should this fail, the row stays without the link. Nothing to undo.
 */
export const linkUsageSuggestionStep = createStep(
  "ai-link-usage-suggestion",
  async (input: { usage_id: string; suggestion_id: string | null }, { container }) => {
    if (input.suggestion_id !== null) {
      await container
        .resolve<AiModuleService>(AI_MODULE)
        .updateAiUsages({ id: input.usage_id, suggestion_id: input.suggestion_id })
    }
    return new StepResponse(true)
  }
)

/**
 * Fails the workflow after a failed call has been recorded (and its quota
 * given back when the service never took it, `releaseUntakenStep`): the
 * panel hears the mapped `ai.*` key, the failed service's id and the
 * other usable services to try (adr/0071 §4). A
 * refused suggestion is no failure here: the service did the work.
 */
export const failOnCallErrorStep = createStep(
  "ai-fail-on-call-error",
  (input: { service: string; outcome: CallOutcome; alternatives: string[] }) => {
    const { outcome } = input
    if (outcome.error_key !== null) {
      throw aiProviderError({
        service: input.service,
        key: outcome.error_key,
        code: outcome.error_code ?? "unexpected",
        alternatives: input.alternatives,
        ...(outcome.retry_after_ms === null ? {} : { retryAfterMs: outcome.retry_after_ms }),
      })
    }
    return new StepResponse(true)
  }
)
