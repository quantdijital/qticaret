import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { aiValidationError } from "../../../lib/ai/errors"
import { notTakenByService } from "../../../lib/ai/outcome"
import { dailyLimits, limitGroupOf } from "../../../lib/ai/limits"
import type { AiLimitGroup } from "../../../lib/ai/limits"
import type { AiCapability } from "../../../lib/ai/registry/capabilities"
import type { AiFunding } from "../../../lib/ai/registry/services"
import { parseEnv } from "../../../lib/env"
import { PlanLimitError } from "../../../lib/errors"
import { draftQuotaOf, forgetUsage } from "../../../lib/plan-limits"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import { CONTENT_DRAFTS_MODULE } from "../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../modules/content-drafts/service"
import type { CallOutcome } from "./call-service"

/** No monthly ceiling of the platform's own: the package's `llm_credits_per_month`, or none. */
const NO_MONTHLY_CEILING = 2_147_483_647

/** The day's ceilings in force: the defaults, or lower values the platform set. */
export function dailyLimitsInForce(env = parseEnv()): Record<AiLimitGroup, number> {
  return dailyLimits({
    text: env.AI_DAILY_LIMIT_TEXT,
    image: env.AI_DAILY_LIMIT_IMAGE,
    video: env.AI_DAILY_LIMIT_VIDEO,
  })
}

export interface Claimed {
  group: AiLimitGroup
  day: string
  month: string
  /** Whether the month's operation was claimed: not on the platform's credits (adr/0085 K9). */
  monthly?: boolean
}

async function release(
  container: Pick<MedusaContainer, "resolve">,
  claimed: Claimed,
  monthly: boolean
): Promise<void> {
  await container.resolve<AiModuleService>(AI_MODULE).releaseDaily(claimed.group, claimed.day)
  if (monthly) {
    await container
      .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
      .releaseQuota(claimed.month)
    forgetUsage("llm_credits_per_month")
  }
}

/**
 * Counts the call before it is made (adr/0071 §8.4): against the day's
 * abuse ceiling of its kind of work, then the month's AI operations
 * (`draft_usage`, the package's `llm_credits_per_month`; adr/0071 §5),
 * each claimed in one statement so two asks at the last one cannot both
 * pass. On the platform's credits the month is not claimed: the credits
 * bound it (the gateway takes them), the day's ceiling holds the same
 * (adr/0085 K9). No compensation: the claim is given back only when the
 * service did not take the job (`releaseUntakenStep`), never because a
 * later step failed after it did.
 */
export async function claimQuota(
  container: Pick<MedusaContainer, "resolve">,
  input: { capability: AiCapability; funding?: AiFunding | undefined },
  now: Date = new Date()
): Promise<Claimed> {
  const group = limitGroupOf(input.capability)
  const ai = container.resolve<AiModuleService>(AI_MODULE)
  const day = await ai.claimDaily(group, dailyLimitsInForce()[group], now)
  if (day === null) {
    throw aiValidationError("ai.daily_limit_reached")
  }
  const claimed: Claimed = { group, day, month: usagePeriodOf(now) }
  if (input.funding === "platform_credit") {
    return { ...claimed, monthly: false }
  }
  const drafts = container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
  // A failing step is not compensated: the day's claim is given back here, whatever failed
  let taken: boolean
  let limit: { used: number; plan: number } | null = null
  try {
    const { quota, plan } = await draftQuotaOf(container, NO_MONTHLY_CEILING)
    taken = await drafts.claimQuota(quota, now)
    if (!taken) {
      limit = { used: await drafts.usedThisMonth(now), plan: plan ?? 0 }
    }
  } catch (error) {
    await release(container, claimed, false)
    throw error
  }
  if (!taken) {
    await release(container, claimed, false)
    throw new PlanLimitError("llm_credits_per_month", limit?.used ?? 0, limit?.plan ?? 0)
  }
  forgetUsage("llm_credits_per_month")
  return claimed
}

export const claimQuotaStep = createStep(
  "ai-claim-quota",
  async (input: { capability: AiCapability; funding?: AiFunding }, { container }) =>
    new StepResponse(await claimQuota(container, input))
)

/** Gives the claim back when the call never became work at the service; whether it did. */
export async function releaseIfUntaken(
  container: Pick<MedusaContainer, "resolve">,
  claimed: Claimed,
  outcome: Pick<CallOutcome, "error_key" | "error_code">
): Promise<boolean> {
  const untaken =
    outcome.error_key !== null && notTakenByService(outcome.error_key, outcome.error_code)
  if (untaken) {
    // The month only where it was claimed: never on the platform's credits
    await release(container, claimed, claimed.monthly !== false)
  }
  return untaken
}

/**
 * Gives the claim back when the call failed before the service took the
 * job (adr/0071 §8.4; `notTakenByService`): a refused key, no balance, a
 * busy or unreachable service, an open circuit, no readable key. A
 * timeout, a blocked content or a refused output may have been charged
 * and stay counted. Runs right after the call, so a later step's failure
 * neither skips it nor gives back a call the service did.
 */
export const releaseUntakenStep = createStep(
  "ai-release-untaken",
  async (input: { claimed: Claimed; outcome: CallOutcome }, { container }) =>
    new StepResponse(await releaseIfUntaken(container, input.claimed, input.outcome))
)
