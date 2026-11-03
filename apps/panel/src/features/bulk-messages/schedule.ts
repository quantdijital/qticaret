import { toOffsetIso } from "@/features/storefront/maintenance"

/**
 * "Zamanla" (adr/0050 §6): the moment typed in a `datetime-local` field,
 * sent with its offset; the backend takes one ahead of now and within 90
 * days (`campaigns.schedule_invalid`), checked here first so the person
 * is told before proving themselves again.
 */

const DAY_MS = 24 * 60 * 60 * 1000
export const SCHEDULE_MAX_DAYS = 90

export type ScheduleProblem = "required" | "past" | "tooFar"

/** What is wrong with the moment, or null; with the moment as the server takes it. */
export function readSchedule(
  local: string,
  now: number = Date.now()
): { at: string; problem: null } | { at: null; problem: ScheduleProblem } {
  const at = toOffsetIso(local)
  if (!at) {
    return { at: null, problem: "required" }
  }
  const time = new Date(at).getTime()
  if (time <= now) {
    return { at: null, problem: "past" }
  }
  if (time >= now + SCHEDULE_MAX_DAYS * DAY_MS) {
    return { at: null, problem: "tooFar" }
  }
  return { at, problem: null }
}

/** The hour in Türkiye (UTC+3 all year), as the backend's `trHour`. */
export const trHour = (now: Date): number => (now.getUTCHours() + 3) % 24

/** Whether a text may go now: from `start` to before `end`, Türkiye time. */
export const withinSmsHours = (now: Date, start: number, end: number): boolean => {
  const hour = trHour(now)
  return hour >= start && hour < end
}

/** `09:00` for 9; 24 reads as the day's end. */
export const hourText = (hour: number): string => `${String(hour).padStart(2, "0")}:00`
