import { MAX_PULL_DAYS } from "./types"

/**
 * BirFatura's dates (adr/0072 §5): `dd.MM.yyyy HH:mm:ss`, as the document
 * writes every date field, in Türkiye's time. Türkiye keeps UTC+3 all year
 * since 2016, so the offset is fixed; no time zone database is read.
 */

const OFFSET_MS = 3 * 3_600_000
const DAY_MS = 86_400_000
const PATTERN = /^(\d{2})\.(\d{2})\.(\d{4}) (\d{2}):(\d{2}):(\d{2})$/

const two = (value: number) => String(value).padStart(2, "0")

/** The moment as BirFatura reads it, in Türkiye's time. */
export function formatBirfaturaDate(at: Date): string {
  const local = new Date(at.getTime() + OFFSET_MS)
  return (
    `${two(local.getUTCDate())}.${two(local.getUTCMonth() + 1)}.${String(local.getUTCFullYear())} ` +
    `${two(local.getUTCHours())}:${two(local.getUTCMinutes())}:${two(local.getUTCSeconds())}`
  )
}

/**
 * The moment a BirFatura date names, or null when it is not one: the
 * pattern, and a day that exists (31.02 is refused, not rolled over).
 */
export function parseBirfaturaDate(text: string): Date | null {
  const match = PATTERN.exec(text.trim())
  if (!match) {
    return null
  }
  const [day, month, year, hour, minute, second] = match.slice(1).map(Number) as [
    number,
    number,
    number,
    number,
    number,
    number,
  ]
  if (hour > 23 || minute > 59 || second > 59) {
    return null
  }
  const local = Date.UTC(year, month - 1, day, hour, minute, second)
  const check = new Date(local)
  if (
    check.getUTCFullYear() !== year ||
    check.getUTCMonth() !== month - 1 ||
    check.getUTCDate() !== day
  ) {
    return null
  }
  return new Date(local - OFFSET_MS)
}

export type PullRange = { start: Date; end: Date } | { problem: "range_invalid" | "range_too_wide" }

/**
 * The range a pull asks for: both dates, in order, and no wider than
 * `MAX_PULL_DAYS` (a pull never pages through a year of buyers).
 */
export function pullRange(startText: string, endText: string): PullRange {
  const start = parseBirfaturaDate(startText)
  const end = parseBirfaturaDate(endText)
  if (!start || !end || start.getTime() > end.getTime()) {
    return { problem: "range_invalid" }
  }
  if (end.getTime() - start.getTime() > MAX_PULL_DAYS * DAY_MS) {
    return { problem: "range_too_wide" }
  }
  return { start, end }
}
