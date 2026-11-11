import { LIMIT_WARNING_RATIO } from "@qticaret/types/control-plane"
import type { LimitStanding } from "@/features/settings/api/plan"

/**
 * How a limit's use reads (adr/0061 §5.3, Ek C14), as the control plane's
 * own usage card reads it: `ok` below 80 %, `warn` from 80 %, `full` at a
 * limit that refuses the next one, `over` past one that only warns (the
 * month's orders: never stopped).
 */
export type UseTone = "ok" | "warn" | "full" | "over"

export function toneOf(standing: LimitStanding): UseTone {
  const { used, max } = standing
  if (used === null || max === null) {
    return "ok"
  }
  const ratio = max === 0 ? (used > 0 ? Infinity : 1) : used / max
  if (ratio >= 1) {
    return standing.kind === "block" ? "full" : "over"
  }
  return ratio >= LIMIT_WARNING_RATIO ? "warn" : "ok"
}

/** Used over allowed for the bar, 0–1 (past 1 capped); null without a limit or a count. */
export function ratioOf(standing: LimitStanding): number | null {
  const { used, max } = standing
  if (used === null || max === null) {
    return null
  }
  return max === 0 ? 1 : Math.min(used / max, 1)
}

/** Whether the next one is refused: a blocking limit used up. */
export const isFull = (standing: LimitStanding | undefined): boolean =>
  standing !== undefined && toneOf(standing) === "full"

/** The limits a screen warns about (adr/0061 §5.3): the blocking four and the month's orders. */
export type NoticedLimit =
  "products" | "staff" | "storage_mb" | "llm_credits_per_month" | "orders_per_month"

/** A limit's notice in words (its i18n key), or null below 80 %. */
export function noticeKey(limit: NoticedLimit, standing: LimitStanding): string | null {
  const tone = toneOf(standing)
  if (tone === "ok") {
    return null
  }
  if (limit === "orders_per_month") {
    return `plan.notice.orders_per_month.${tone === "over" ? "over" : "near"}`
  }
  return `plan.notice.${limit}.${tone === "full" ? "full" : "near"}`
}

/** A package code as a name until the plan document carries one (`standart` → "Standart"). */
export const packageName = (code: string): string => {
  const words = code.replace(/[-_]+/g, " ").trim()
  return words.charAt(0).toLocaleUpperCase("tr-TR") + words.slice(1)
}

/** The rows Settings > Abonelik lists: every limit but the ones not applied yet. */
export const shownLimits = (limits: readonly LimitStanding[]): LimitStanding[] =>
  limits.filter((limit) => limit.kind !== "later")
