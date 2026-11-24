import type { MedusaContainer } from "@medusajs/framework/types"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { ASSISTANT_GROUP, assistantLimits, assistantUserGroup } from "../../../lib/ai/limits"
import { parseEnv } from "../../../lib/env"
import { draftQuotaOf, forgetUsage } from "../../../lib/plan-limits"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import { CONTENT_DRAFTS_MODULE } from "../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../modules/content-drafts/service"

type Resolver = Pick<MedusaContainer, "resolve">

/** No monthly ceiling of the platform's own: the package's `llm_credits_per_month`, or none. */
const NO_MONTHLY_CEILING = 2_147_483_647

/** One model call claimed: the shop's day, the person's day, the month's credit. */
export interface AssistantClaim {
  day: string
  user_day: string
  /** `YYYY-MM`, the month whose operation was claimed. */
  month: string
}

export type ClaimResult =
  { ok: true; claim: AssistantClaim } | { ok: false; reason: "daily_limit" | "credits" }

/** The assistant's ceilings in force (adr/0079 §8). */
export const assistantLimitsInForce = (env = parseEnv()) =>
  assistantLimits({ shop: env.AI_ASSISTANT_DAILY_LIMIT, user: env.AI_ASSISTANT_USER_DAILY_LIMIT })

/**
 * Claims one model call before it is made (adr/0079 §8, adr/0071 §8.4):
 * the shop's `assistant` day, then the person's own, then one of the
 * month's AI operations (`llm_credits_per_month`), each in one statement.
 * A refusal gives back what was claimed before it.
 */
export async function claimAssistantCall(
  container: Resolver,
  userId: string,
  now: Date = new Date()
): Promise<ClaimResult> {
  const limits = assistantLimitsInForce()
  const ai = container.resolve<AiModuleService>(AI_MODULE)
  const day = await ai.claimDaily(ASSISTANT_GROUP, limits.shop, now)
  if (day === null) {
    return { ok: false, reason: "daily_limit" }
  }
  const userDay = await ai.claimDaily(assistantUserGroup(userId), limits.user, now)
  if (userDay === null) {
    await ai.releaseDaily(ASSISTANT_GROUP, day)
    return { ok: false, reason: "daily_limit" }
  }
  const drafts = container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
  let taken = false
  try {
    const { quota } = await draftQuotaOf(container, NO_MONTHLY_CEILING)
    taken = await drafts.claimQuota(quota, now)
  } finally {
    if (!taken) {
      await ai.releaseDaily(assistantUserGroup(userId), userDay)
      await ai.releaseDaily(ASSISTANT_GROUP, day)
    }
  }
  if (!taken) {
    return { ok: false, reason: "credits" }
  }
  forgetUsage("llm_credits_per_month")
  return { ok: true, claim: { day, user_day: userDay, month: usagePeriodOf(now) } }
}

/** Gives a claimed call back: the service never took it (adr/0071 §8.4). */
export async function releaseAssistantCall(
  container: Resolver,
  userId: string,
  claim: AssistantClaim
): Promise<void> {
  const ai = container.resolve<AiModuleService>(AI_MODULE)
  await ai.releaseDaily(ASSISTANT_GROUP, claim.day)
  await ai.releaseDaily(assistantUserGroup(userId), claim.user_day)
  await container
    .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    .releaseQuota(claim.month)
  forgetUsage("llm_credits_per_month")
}
