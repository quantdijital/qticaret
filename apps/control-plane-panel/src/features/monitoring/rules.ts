import { LIMIT_REGISTRY, LIMIT_WARNING_RATIO, isGrantLimit } from "@qticaret/types/control-plane"
import type { CountedLimitKey, LimitKey } from "@qticaret/types/control-plane"
import type { StatusTone } from "@qticaret/admin-ui/patterns/status-badge"
import type { EffectiveLimit } from "@/features/tenants/api"
import type { HealthState, TargetHealth, UsageCounts } from "./api"

/**
 * How a shop's use reads against what it may use (adr/0061 §5.3, Ek C13):
 * `ok` below 80 %, `warn` from 80 %, `full` at or past a limit that
 * blocks. The monthly orders are never blocked (nor custom domains yet):
 * past their limit they only warn (`over`), in words, never as a refusal.
 */
export type UseTone = "ok" | "warn" | "full" | "over"

export interface UseRow {
  key: LimitKey
  used: number | null
  /** What applies: null for no limit. */
  limit: number | null
  /** Used over limit, 0–1 shown (past 1 capped); null without a limit or a count. */
  ratio: number | null
  tone: UseTone
}

/**
 * Each limit's own count in the report; custom domains are the shop's
 * record's. A grant (AI free credits, adr/0085 K5) is no use to count: the
 * card leaves it out.
 */
const COUNT_OF: Record<CountedLimitKey, keyof UsageCounts | null> = {
  products: "products",
  orders_per_month: "orders_this_month",
  staff: "staff",
  storage_mb: "storage_mb",
  llm_credits_per_month: "llm_credits_this_month",
  custom_domains: null,
}

export function toneOf(key: LimitKey, used: number, limit: number | null): UseTone {
  if (limit === null) {
    return "ok"
  }
  const ratio = limit === 0 ? (used > 0 ? Infinity : 1) : used / limit
  if (ratio >= 1) {
    return LIMIT_REGISTRY[key].enforcement === "block" ? "full" : "over"
  }
  return ratio >= LIMIT_WARNING_RATIO ? "warn" : "ok"
}

/** The rows of the usage card, in the registry's order. */
export function usageRows(
  limits: readonly EffectiveLimit[],
  counts: UsageCounts | null,
  customDomains: number
): UseRow[] {
  return limits.flatMap(({ key, value }): UseRow[] => {
    if (isGrantLimit(key)) {
      return []
    }
    const field = COUNT_OF[key]
    const used = field ? (counts ? counts[field] : null) : customDomains
    if (used === null) {
      return [{ key, used: null, limit: value, ratio: null, tone: "ok" }]
    }
    const ratio = value === null ? null : value === 0 ? 1 : Math.min(used / value, 1)
    return [{ key, used, limit: value, ratio, tone: toneOf(key, used, value) }]
  })
}

export const USE_TONES: Record<UseTone, StatusTone> = {
  ok: "neutral",
  warn: "warning",
  full: "danger",
  over: "warning",
}

/** A target's state in one word's tone; "unknown" (never probed) and "off" (no address) are neutral. */
export type HealthWord = HealthState | "unknown" | "off"

export const wordOf = (target: TargetHealth): HealthWord =>
  !target.probed && !target.standing ? "off" : (target.standing?.state ?? "unknown")

export const HEALTH_TONES: Record<HealthWord, StatusTone> = {
  healthy: "success",
  failing: "warning",
  unhealthy: "danger",
  unknown: "neutral",
  off: "neutral",
}

/** The worse of a shop's two standings, for the shops list; null when neither was probed. */
export function worstOf(states: (HealthState | null)[]): HealthState | null {
  const order: HealthState[] = ["unhealthy", "failing", "healthy"]
  return order.find((state) => states.includes(state)) ?? null
}

/** The answered share of a day's probes, 0–1; null without one. */
export const uptimeOf = (day: { total: number; ok: number }): number | null =>
  day.total === 0 ? null : day.ok / day.total
