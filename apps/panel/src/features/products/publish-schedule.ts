import { DEFAULT_ZONE, localOf, zonedIso } from "@/features/products/booking/slot-dates"

/**
 * A draft's planned publish (S2) as the backend keeps it in the product's
 * metadata (`lib/catalog/publish-schedule.ts`): the moment in UTC, typed
 * and shown as the wall clock in Türkiye whatever the browser's zone.
 */

const DAY_MS = 24 * 60 * 60 * 1000
export const PUBLISH_MAX_DAYS = 366

export interface PublishSchedule {
  publish_at: string | null
  failed: { at: string; reason: string } | null
}

const momentOf = (value: unknown): string | null =>
  typeof value === "string" && !Number.isNaN(Date.parse(value)) ? value : null

/** The plan read from a product's metadata; anything unreadable reads as none. */
export function publishScheduleOf(
  product: { status?: string | null; metadata?: Record<string, unknown> | null } | undefined
): PublishSchedule {
  const metadata = product?.metadata ?? {}
  const failed = metadata["publish_failed"]
  const failure =
    failed && typeof failed === "object" ? (failed as Record<string, unknown>) : undefined
  const at = momentOf(failure?.["at"])
  const reason = failure?.["reason"]
  return {
    publish_at: product?.status === "draft" ? momentOf(metadata["publish_at"]) : null,
    failed: product?.status === "draft" && at && typeof reason === "string" ? { at, reason } : null,
  }
}

export type ScheduleProblem = "required" | "past" | "tooFar"

/** The moment typed (`2026-11-28T10:00`, Türkiye) as the server takes it, or what is wrong. */
export function readPublishAt(
  local: string,
  now: number = Date.now()
): { at: string; problem: null } | { at: null; problem: ScheduleProblem } {
  const at = zonedIso(local, DEFAULT_ZONE)
  if (!at) {
    return { at: null, problem: "required" }
  }
  const time = Date.parse(at)
  if (time <= now) {
    return { at: null, problem: "past" }
  }
  if (time > now + PUBLISH_MAX_DAYS * DAY_MS) {
    return { at: null, problem: "tooFar" }
  }
  return { at, problem: null }
}

/** The field's starting value: the plan, or tomorrow 10:00 in Türkiye. */
export function publishFieldValue(publishAt: string | null, now: number = Date.now()): string {
  if (publishAt) {
    return localOf(publishAt, DEFAULT_ZONE)
  }
  const tomorrow = localOf(new Date(now + DAY_MS).toISOString(), DEFAULT_ZONE)
  return `${tomorrow.slice(0, 10)}T10:00`
}

/** The plan in short, as the list's badge shows it: "28 Kas 10:00". */
export function formatPublishAt(iso: string): string {
  const parts = new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    timeZone: DEFAULT_ZONE,
  }).formatToParts(new Date(iso))
  const part = (type: string) => parts.find((each) => each.type === type)?.value ?? ""
  return `${part("day")} ${part("month")} ${part("hour")}:${part("minute")}`
}
