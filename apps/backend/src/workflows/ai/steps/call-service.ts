import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { withAiBreaker } from "../../../lib/ai/breaker"
import { textConnectorFor, textTargetOf } from "../../../lib/ai/connector-of"
import type { AiImageInput } from "../../../lib/ai/connectors/types"
import { aiProviderError } from "../../../lib/ai/errors"
import type { AiErrorKey } from "../../../lib/ai/errors"
import { readVisionSource, visionImage } from "../../../lib/ai/image-input"
import { failureOf } from "../../../lib/ai/outcome"
import type { AiCapability } from "../../../lib/ai/registry/capabilities"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import type { CardAllowed } from "../../../lib/ai/product-card"
import { runCardTask } from "../../../lib/ai/run-card"
import { runTextTask } from "../../../lib/ai/run-text"
import { correctionClaim, correctionUsageOf } from "./correction-claim"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../../modules/integration-credentials"
import { isCredentialProvider } from "../../../modules/integration-credentials/providers"
import type IntegrationCredentialsModuleService from "../../../modules/integration-credentials/service"

export interface CallServiceInput {
  task: string
  capability: AiCapability
  service: string
  system: string
  data: string
  /** A vision task's picture: its stored file, read here (never an address, never its bytes in a step). */
  image_file_id?: string | null
  /** A product card's lists, read on the server (task-input); its answer may name nothing else. */
  allowed?: CardAllowed | null
}

/** How the call ended; never the key, the service's own words or its raw answer. */
export interface CallOutcome {
  status: "succeeded" | "refused" | "failed" | "timeout" | "cancelled"
  model: string
  /** The gated suggestion; only when `succeeded`. The first candidate when there are several. */
  text: string | null
  /** Every gated candidate in order (adr/0074 §4); `[text]` for a one-text task, empty unless `succeeded`. */
  candidates: string[]
  /**
   * The correction call (adr/0074 §4), when the first answer had no
   * candidate through the gate: recorded as its own usage row. The fields
   * above then describe the first call's usage (it was refused) and the
   * suggestion as offered (the correction's, when it passed).
   */
  correction: CorrectionUsage | null
  /** The gate's problems; only when `refused`. */
  problems: string[]
  input_tokens: number | null
  output_tokens: number | null
  /** Pictures sent (vision) or given back (an image edit); null for a text task. */
  images: number | null
  duration_ms: number
  error_key: AiErrorKey | null
  error_code: string | null
  retry_after_ms: number | null
}

/** The correction call's usage row: how it ended and what it counted. */
export interface CorrectionUsage {
  status: CallOutcome["status"]
  input_tokens: number | null
  output_tokens: number | null
  images: number | null
  duration_ms: number
  error_code: string | null
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

/**
 * A vision task's picture from the shop's own file storage, re-encoded
 * for the call (lib/ai/image-input.ts). Anything unreadable is
 * `ai.input_unsupported`, before the service is called.
 */
async function pictureOf(
  container: Pick<MedusaContainer, "resolve">,
  fileId: string | null,
  service: string
): Promise<AiImageInput> {
  if (fileId === null || fileId === "") {
    throw aiProviderError({ service, key: "ai.input_unsupported", code: "image_missing" })
  }
  let bytes: Buffer | null
  try {
    // Streamed and cut at the source limit: a large file is never read whole
    bytes = await readVisionSource(await container.resolve(Modules.FILE).getDownloadStream(fileId))
  } catch {
    throw aiProviderError({ service, key: "ai.input_unsupported", code: "image_unreadable" })
  }
  if (bytes === null) {
    throw aiProviderError({ service, key: "ai.input_unsupported", code: "image_size" })
  }
  return visionImage(bytes, service)
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
      candidates: [],
      correction: null,
      problems: [],
      input_tokens: null,
      output_tokens: null,
      images: null,
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
      const images =
        capability === "vision"
          ? [await pictureOf(container, input.image_file_id ?? null, input.service)]
          : undefined
      const prompt = { system: input.system, data: input.data }
      const withImages = images === undefined ? {} : { images }
      // A second call, when no candidate passed, takes a place under the day's ceiling only
      const claim = correctionClaim(container, input.capability)
      // A product card is read against its closed schema and the shop's lists, never as free text
      const result = await withAiBreaker(input.service, () =>
        task.gate === "product_card"
          ? runCardTask({
              connector,
              task,
              prompt,
              allowed: input.allowed ?? { categories: [], attributes: [] },
              ...withImages,
            })
          : runTextTask({ connector, task, prompt, mayCorrect: claim.mayCorrect, ...withImages })
      )
      await claim.settle(result.correction)
      const correction = correctionUsageOf(result.correction, images?.length ?? null)
      const outcome: CallOutcome = {
        ...base,
        images: images?.length ?? null,
        status: result.status,
        text: result.status === "succeeded" ? result.text : null,
        candidates: result.status === "succeeded" ? result.candidates : [],
        correction,
        problems: result.status === "refused" ? result.problems : [],
        input_tokens: result.usage.inputTokens ?? null,
        output_tokens: result.usage.outputTokens ?? null,
        // The first call's own time; the correction's is on its row
        duration_ms: Date.now() - started - (correction?.duration_ms ?? 0),
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
