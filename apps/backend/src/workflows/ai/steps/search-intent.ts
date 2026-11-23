import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { withAiBreaker } from "../../../lib/ai/breaker"
import { textConnectorFor, textTargetOf } from "../../../lib/ai/connector-of"
import { estimateCost } from "../../../lib/ai/cost"
import { aiProviderError, aiValidationError } from "../../../lib/ai/errors"
import type { AiErrorKey } from "../../../lib/ai/errors"
import { searchListsOf } from "../../../lib/ai/facts/search-lists"
import { STOREFRONT_SEARCH_GROUP, storefrontSearchLimit } from "../../../lib/ai/limits"
import { failureOf, notTakenByService } from "../../../lib/ai/outcome"
import { findAiService } from "../../../lib/ai/registry/services"
import { SEARCH_INTENT_TASK, STOREFRONT_REQUESTER } from "../../../lib/ai/registry/search-tasks"
import { runSearchIntent } from "../../../lib/ai/search-intent/run"
import type { DroppedPart, SearchFilter, SearchLists } from "../../../lib/ai/search-intent/types"
import { chooseService, usableServices } from "../../../lib/ai/select"
import { parseEnv } from "../../../lib/env"
import { logger } from "../../../lib/logging"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import { aiConnectionsOf, aiFlagsOf, taskFlagOpen } from "../connections"
import { apiKeyOf } from "./call-service"

/**
 * The search intent's steps (adr/0077 §7, adr/0071 §8): the same life as
 * a staff task's, narrowed to the storefront. The service is the shop's
 * own key only (no platform credit, no preference: no person asks); the
 * call counts against its own daily ceiling, given back when the service
 * never took it; the usage row names the asker `vitrin` and holds no text,
 * nor does the log line. The sentence lives in the steps' input only
 * (the workflow is neither stored nor retained).
 */

/** A shopper waits for the answer: far less than a staff task's minute. */
export const SEARCH_TIMEOUT_MS = 8_000

/** The shop's own key that runs it, or `ai.feature_off` / `ai.no_service`. */
export const searchServiceStep = createStep(
  "ai-search-service",
  async (_input: Record<string, never>, { container }) => {
    const task = SEARCH_INTENT_TASK
    if (!(await taskFlagOpen(container, task))) {
      throw aiValidationError("ai.feature_off")
    }
    const [connections, flags] = await Promise.all([
      aiConnectionsOf(container),
      aiFlagsOf(container),
    ])
    // The shop's own key only: platform credits never pay for a shopper's search
    const usable = usableServices(task, connections, { ownKeys: flags.ownKeys })
    const choice = chooseService({ task, usable })
    if (!choice.ok) {
      throw aiValidationError(choice.error)
    }
    return new StepResponse({ service: choice.service.id, funding: choice.service.funding })
  }
)

/** The shop's lists and its today; nothing to undo. */
export const searchListsStep = createStep(
  "ai-search-lists",
  async (_input: Record<string, never>, { container }) =>
    new StepResponse(await searchListsOf(container))
)

/** One call claimed under the storefront's own ceiling, in one statement. */
export const claimSearchStep = createStep(
  "ai-search-claim",
  async (_input: Record<string, never>, { container }) => {
    const limit = storefrontSearchLimit(parseEnv().AI_STORE_SEARCH_DAILY_LIMIT)
    const day = await container
      .resolve<AiModuleService>(AI_MODULE)
      .claimDaily(STOREFRONT_SEARCH_GROUP, limit)
    if (day === null) {
      throw aiValidationError("ai.daily_limit_reached")
    }
    return new StepResponse({ day })
  }
)

/** How the call ended; never the key, the sentence, the answer or the service's words. */
export interface SearchOutcome {
  status: "succeeded" | "refused" | "failed" | "timeout" | "cancelled"
  model: string
  filter: SearchFilter | null
  dropped: DroppedPart[]
  input_tokens: number | null
  output_tokens: number | null
  duration_ms: number
  error_key: AiErrorKey | null
  error_code: string | null
}

/** The call through the service's breaker; a failure is returned so its usage row is written. */
export const callSearchStep = createStep(
  "ai-search-call",
  async (input: { service: string; text: string; lists: SearchLists }, { container }) => {
    const started = Date.now()
    const resolved = textTargetOf(input.service, "text")
    const base = {
      model: resolved?.target.model ?? "",
      filter: null,
      dropped: [],
      input_tokens: null,
      output_tokens: null,
    }
    try {
      if (!resolved) {
        throw aiProviderError({
          service: input.service,
          key: "ai.service_unavailable",
          code: "not_registered",
        })
      }
      const apiKey = await apiKeyOf(container, resolved.service.credentialProvider)
      if (apiKey === null) {
        throw aiProviderError({
          service: input.service,
          key: "ai.service_unavailable",
          code: "no_credentials",
        })
      }
      const connector = textConnectorFor(input.service, "text", apiKey)
      const result = await withAiBreaker(input.service, () =>
        runSearchIntent({
          connector,
          text: input.text,
          lists: input.lists,
          signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
        })
      )
      const outcome: SearchOutcome = {
        ...base,
        status: result.status,
        filter: result.status === "succeeded" ? result.filter : null,
        dropped: result.status === "succeeded" ? result.dropped : [],
        input_tokens: result.usage.inputTokens ?? null,
        output_tokens: result.usage.outputTokens ?? null,
        duration_ms: Date.now() - started,
        error_key: null,
        error_code: null,
      }
      return new StepResponse(outcome)
    } catch (error) {
      const failure = failureOf(error)
      const outcome: SearchOutcome = {
        ...base,
        status: failure.status,
        duration_ms: Date.now() - started,
        error_key: failure.key,
        error_code: failure.code,
      }
      return new StepResponse(outcome)
    }
  }
)

/** Gives the day's claim back when the service never took the job (adr/0071 §8.4). */
export const releaseSearchStep = createStep(
  "ai-search-release",
  async (input: { day: string; outcome: SearchOutcome }, { container }) => {
    const { outcome } = input
    const untaken =
      outcome.error_key !== null && notTakenByService(outcome.error_key, outcome.error_code)
    if (untaken) {
      await container
        .resolve<AiModuleService>(AI_MODULE)
        .releaseDaily(STOREFRONT_SEARCH_GROUP, input.day)
    }
    return new StepResponse(untaken)
  }
)

/**
 * The attempt's usage row and its `ai.call` line: counts and codes only.
 * No record (`entity_*` empty), the asker `vitrin`, no text of any kind.
 * Not undone: a call made stays recorded.
 */
export const recordSearchUsageStep = createStep(
  "ai-search-record",
  async (
    input: { service: string; funding: "own_key" | "platform_credit"; outcome: SearchOutcome },
    { container }
  ) => {
    const { outcome } = input
    const task = SEARCH_INTENT_TASK
    const service = findAiService(input.service)
    const cost = service
      ? estimateCost(service, task.capability, {
          ...(outcome.input_tokens === null ? {} : { inputTokens: outcome.input_tokens }),
          ...(outcome.output_tokens === null ? {} : { outputTokens: outcome.output_tokens }),
        })
      : null
    const id = await container.resolve<AiModuleService>(AI_MODULE).recordUsage({
      task: task.id,
      capability: task.capability,
      service: input.service,
      model: outcome.model,
      funding: input.funding,
      status: outcome.status,
      input_tokens: outcome.input_tokens,
      output_tokens: outcome.output_tokens,
      estimated_cost_micros: cost?.micros ?? null,
      currency: cost?.currency ?? null,
      entity_type: null,
      entity_id: null,
      suggestion_id: null,
      duration_ms: outcome.duration_ms,
      error_code: outcome.error_code,
      requested_by: STOREFRONT_REQUESTER,
    })
    logger.info({
      event: "ai.call",
      task: task.id,
      capability: task.capability,
      service: input.service,
      funding: input.funding,
      status: outcome.status,
      duration_ms: outcome.duration_ms,
      input_tokens: outcome.input_tokens,
      output_tokens: outcome.output_tokens,
      error_code: outcome.error_code,
    })
    return new StepResponse({ usage_id: id })
  }
)
