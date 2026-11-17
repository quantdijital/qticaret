import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { aiValidationError } from "../../../lib/ai/errors"
import { dailyLimits, limitGroupOf } from "../../../lib/ai/limits"
import type { AiLimitGroup } from "../../../lib/ai/limits"
import type { AiCapability } from "../../../lib/ai/registry/capabilities"
import { parseEnv } from "../../../lib/env"
import { PlanLimitError } from "../../../lib/errors"
import { draftQuotaOf, forgetUsage } from "../../../lib/plan-limits"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import { CONTENT_DRAFTS_MODULE } from "../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../modules/content-drafts/service"

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

interface Claimed {
  group: AiLimitGroup
  day: string
  month: string
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
 * pass. Undone when a later step fails: the call failed before the
 * service took it, so both are given back.
 */
export const claimQuotaStep = createStep(
  "ai-claim-quota",
  async (input: { capability: AiCapability }, { container }) => {
    const now = new Date()
    const group = limitGroupOf(input.capability)
    const ai = container.resolve<AiModuleService>(AI_MODULE)
    const day = await ai.claimDaily(group, dailyLimitsInForce()[group], now)
    if (day === null) {
      throw aiValidationError("ai.daily_limit_reached")
    }
    const claimed: Claimed = { group, day, month: usagePeriodOf(now) }
    const drafts = container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    const { quota, plan } = await draftQuotaOf(container, NO_MONTHLY_CEILING)
    if (!(await drafts.claimQuota(quota, now))) {
      // A failing step is not compensated: the day's claim is given back here
      await release(container, claimed, false)
      throw new PlanLimitError("llm_credits_per_month", await drafts.usedThisMonth(now), plan ?? 0)
    }
    forgetUsage("llm_credits_per_month")
    return new StepResponse(claimed, claimed)
  },
  async (claimed, { container }) => {
    if (claimed) {
      await release(container, claimed, true)
    }
  }
)
