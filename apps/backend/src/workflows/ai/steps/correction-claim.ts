import type { MedusaContainer } from "@medusajs/framework/types"
import { limitGroupOf } from "../../../lib/ai/limits"
import { failureOf, notTakenByService } from "../../../lib/ai/outcome"
import type { AiCapability } from "../../../lib/ai/registry/capabilities"
import type { CorrectionAttempt } from "../../../lib/ai/run-text"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import type { CorrectionUsage } from "./call-service"
import { dailyLimitsInForce } from "./claim-quota"

/**
 * The correction call's place (adr/0074 §4): it counts against the day's
 * ceiling of its kind of work, claimed in one statement as every call is
 * (`claimDaily`), and never against the month's AI operations, which the
 * ask already took once. A full day means no correction: the first
 * refusal stands. Given back, as any call's, when the service never took
 * the job.
 */
export function correctionClaim(
  container: Pick<MedusaContainer, "resolve">,
  capability: AiCapability
) {
  const ai = container.resolve<AiModuleService>(AI_MODULE)
  const group = limitGroupOf(capability)
  let day: string | null = null
  return {
    mayCorrect: async (): Promise<boolean> => {
      day = await ai.claimDaily(group, dailyLimitsInForce()[group])
      return day !== null
    },
    /** Gives the day's place back when the correction never became work at the service. */
    settle: async (correction: CorrectionAttempt | null): Promise<void> => {
      if (day === null || correction?.status !== "failed") {
        return
      }
      const failure = failureOf(correction.error)
      if (notTakenByService(failure.key, failure.code)) {
        await ai.releaseDaily(group, day)
      }
    },
  }
}

/** The correction's usage row, or null when no correction was made. */
export function correctionUsageOf(
  correction: CorrectionAttempt | null,
  images: number | null
): CorrectionUsage | null {
  if (correction === null) {
    return null
  }
  if (correction.status === "failed") {
    const failure = failureOf(correction.error)
    return {
      status: failure.status,
      input_tokens: null,
      output_tokens: null,
      images,
      duration_ms: correction.duration_ms,
      error_code: failure.code,
    }
  }
  const { attempt } = correction
  return {
    status: attempt.status,
    input_tokens: attempt.usage.inputTokens ?? null,
    output_tokens: attempt.usage.outputTokens ?? null,
    images,
    duration_ms: attempt.duration_ms,
    error_code: null,
  }
}
