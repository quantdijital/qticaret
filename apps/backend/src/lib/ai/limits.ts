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

/** A day's counter: a kind of staff work, or the storefront's search. */
export type AiDailyGroup = AiLimitGroup | typeof STOREFRONT_SEARCH_GROUP

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
