import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { withAiBreaker } from "../../../lib/ai/breaker"
import { textConnectorFor, textTargetOf } from "../../../lib/ai/connector-of"
import { aiProviderError } from "../../../lib/ai/errors"
import type { AiErrorKey } from "../../../lib/ai/errors"
import { failureOf } from "../../../lib/ai/outcome"
import type { AiCapability } from "../../../lib/ai/registry/capabilities"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import { runTextTask } from "../../../lib/ai/run-text"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import { isCredentialProvider } from "../../../modules/integration-credentials/providers"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"

export interface CallServiceInput {
  task: string
  capability: AiCapability
  service: string
  system: string
  data: string
}

/** How the call ended; never the key, the service's own words or its raw answer. */
export interface CallOutcome {
  status: "succeeded" | "refused" | "failed" | "timeout" | "cancelled"
  model: string
  /** The gated suggestion; only when `succeeded`. */
  text: string | null
  /** The gate's problems; only when `refused`. */
  problems: string[]
  input_tokens: number | null
  output_tokens: number | null
  duration_ms: number
  error_key: AiErrorKey | null
  error_code: string | null
  retry_after_ms: number | null
}

/**
 * The shop's key for the service, read here and nowhere else: it is no
 * part of a step's input or output (`workflow_execution` keeps those), of
 * a log or of an error. A service without a readable key cannot be called.
 */
export async function apiKeyOf(
  container: Pick<MedusaContainer, "resolve">,
  credentialProvider: string
): Promise<string | null> {
  if (!isCredentialProvider(credentialProvider)) {
    return null
  }
  const account = await container
    .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
    .read(credentialProvider)
  const key = account?.secrets["api_key"]
  return typeof key === "string" && key !== "" ? key : null
}

export const retryAfterOf = (error: unknown): number | null => {
  const value = (error as { retryAfterMs?: unknown } | null)?.retryAfterMs
  return typeof value === "number" ? value : null
}

/**
 * The call (adr/0071 §8.5, §8.6): the connector is built from the
 * registry inside this step with the key it reads, the call goes through
 * the service's circuit breaker, and its answer through the gate in the
 * same function (`runTextTask`), so no text reaches a suggestion without
 * passing it. A failure is returned, not thrown, so that its usage row is
 * written before the workflow fails and gives the quota back.
 *
 * No compensation: a text call leaves no remote job to cancel and no file
 * to delete, and a call made cannot be taken back (§8.5).
 */
export const callServiceStep = createStep(
  "ai-call-service",
  async (input: CallServiceInput, { container }) => {
    const started = Date.now()
    const task = findAiTask(input.task)
    const capability = input.capability === "vision" ? "vision" : "text"
    const resolved = textTargetOf(input.service, capability)
    const base = {
      model: resolved?.target.model ?? "",
      text: null,
      problems: [],
      input_tokens: null,
      output_tokens: null,
      error_key: null,
      error_code: null,
      retry_after_ms: null,
    }
    try {
      if (!task || !resolved || task.capability !== input.capability) {
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
      const connector = textConnectorFor(input.service, capability, apiKey)
      const result = await withAiBreaker(input.service, () =>
        runTextTask({ connector, task, prompt: { system: input.system, data: input.data } })
      )
      const outcome: CallOutcome = {
        ...base,
        status: result.status,
        text: result.status === "succeeded" ? result.text : null,
        problems: result.status === "refused" ? result.problems : [],
        input_tokens: result.usage.inputTokens ?? null,
        output_tokens: result.usage.outputTokens ?? null,
        duration_ms: Date.now() - started,
      }
      return new StepResponse(outcome)
    } catch (error) {
      const failure = failureOf(error)
      const outcome: CallOutcome = {
        ...base,
        status: failure.status,
        duration_ms: Date.now() - started,
        error_key: failure.key,
        error_code: failure.code,
        retry_after_ms: retryAfterOf(error),
      }
      return new StepResponse(outcome)
    }
  }
)
