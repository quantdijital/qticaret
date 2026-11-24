import type { AiCapability } from "./registry/capabilities"

/**
 * The daily abuse ceiling (adr/0071 §8): calls a shop may make in a day,
 * by kind of work. It holds on the shop's own key too, so a stolen staff
 * session cannot empty the shop's account at a service. The platform may
 * lower a default from the environment, never raise it.
 */

export const AI_LIMIT_GROUPS = ["text", "image", "video"] as const
export type AiLimitGroup = (typeof AI_LIMIT_GROUPS)[number]

export const DEFAULT_DAILY_LIMITS: Readonly<Record<AiLimitGroup, number>> = {
  text: 500,
  image: 100,
  video: 10,
}

const GROUP_OF: Readonly<Record<AiCapability, AiLimitGroup>> = {
  text: "text",
  vision: "text",
  image_edit: "image",
  image_generate: "image",
  video: "video",
}

export const limitGroupOf = (capability: AiCapability): AiLimitGroup => GROUP_OF[capability]

/** The ceilings in force: a default, or a lower value the platform set (0 closes the group). */
export function dailyLimits(
  lowered: Readonly<Partial<Record<AiLimitGroup, number | undefined>>> = {}
): Record<AiLimitGroup, number> {
  const limit = (group: AiLimitGroup) => {
    const value = lowered[group]
    const fallback = DEFAULT_DAILY_LIMITS[group]
    return value !== undefined && Number.isSafeInteger(value) && value >= 0
      ? Math.min(value, fallback)
      : fallback
  }
  return { text: limit("text"), image: limit("image"), video: limit("video") }
}

/**
 * The storefront's search intent (adr/0077 §7): shoppers' calls counted
 * on their own, apart from the staff's `text`, so a busy shop front can
 * neither use up the staff's day nor be stopped by it. Its ceiling is the
 * platform's to set (`AI_STORE_SEARCH_DAILY_LIMIT`), 0 closing it.
 */
export const STOREFRONT_SEARCH_GROUP = "storefront_search"
export const DEFAULT_STOREFRONT_SEARCH_LIMIT = 500

/**
 * The panel assistant (adr/0079 §8): its model calls counted on their
 * own, so the staff's ✨ buttons never stop because of it; a ceiling for
 * the shop and one for each person (`assistant_user:<id>`, deleted when
 * the person leaves). The platform may lower either from the environment.
 */
export const ASSISTANT_GROUP = "assistant"
export const DEFAULT_ASSISTANT_SHOP_LIMIT = 300
export const DEFAULT_ASSISTANT_USER_LIMIT = 100

/** A person's own assistant counter. */
export const assistantUserGroup = (userId: string): `assistant_user:${string}` =>
  `assistant_user:${userId}`

/** The assistant's ceilings in force: a default, or a lower value the platform set (0 closes it). */
export function assistantLimits(lowered: {
  shop?: number | undefined
  user?: number | undefined
}): {
  shop: number
  user: number
} {
  const limit = (value: number | undefined, fallback: number) =>
    value !== undefined && Number.isSafeInteger(value) && value >= 0
      ? Math.min(value, fallback)
      : fallback
  return {
    shop: limit(lowered.shop, DEFAULT_ASSISTANT_SHOP_LIMIT),
    user: limit(lowered.user, DEFAULT_ASSISTANT_USER_LIMIT),
  }
}

/** A day's counter: a kind of staff work, the storefront's search, or the assistant's. */
export type AiDailyGroup =
  | AiLimitGroup
  | typeof STOREFRONT_SEARCH_GROUP
  | typeof ASSISTANT_GROUP
  | `assistant_user:${string}`

/** The storefront search's ceiling in force: the platform's value, else the default. */
export const storefrontSearchLimit = (value: number | undefined): number =>
  value !== undefined && Number.isSafeInteger(value) && value >= 0
    ? value
    : DEFAULT_STOREFRONT_SEARCH_LIMIT

/** Whether one more call of this capability fits in the day. */
export function withinDailyLimit(
  capability: AiCapability,
  usedToday: number,
  limits: Readonly<Record<AiLimitGroup, number>> = DEFAULT_DAILY_LIMITS
): boolean {
  return usedToday < limits[limitGroupOf(capability)]
}
