import { z } from "zod"
import { parseCountInput } from "@qticaret/admin-ui/lib/money-input"
import type { CancellationTier } from "@/features/products/api/booking"

const F = "products.booking.errors.form"

/** The server's limits (`lib/booking/settings.ts` CancellationTiers). */
export const TIER_LIMITS = { days: 365, percent: 100, rows: 10 } as const

/** Package travel (adr/0076 D7a): 30 days or more before the date always refunds in full. */
export const PACKAGE_TRAVEL_FREE_DAYS = 30

const countIn = (text: string, min: number, max: number): boolean => {
  const value = parseCountInput(text)
  return value !== null && value >= min && value <= max
}

const tierRow = z.object({
  days_before: z.string().refine((text) => countIn(text, 0, TIER_LIMITS.days), `${F}.tierDays`),
  fee_percent: z
    .string()
    .refine((text) => countIn(text, 0, TIER_LIMITS.percent), `${F}.tierPercent`),
})
export type TierDraft = z.infer<typeof tierRow>

const numbersOf = (rows: readonly TierDraft[]) =>
  rows.map((row) => ({
    days: parseCountInput(row.days_before),
    percent: parseCountInput(row.fee_percent),
  }))

/**
 * "N days or more before, X% kept": at most ten, one per day count, and
 * closer to the date never keeps less (the server refuses either).
 */
export const tiersSchema = z
  .array(tierRow)
  .max(TIER_LIMITS.rows, `${F}.tierRows`)
  .superRefine((rows, ctx) => {
    const numbers = numbersOf(rows)
    const seen = new Set<number>()
    numbers.forEach((row, index) => {
      if (row.days === null) {
        return
      }
      if (seen.has(row.days)) {
        ctx.addIssue({ code: "custom", path: [index, "days_before"], message: `${F}.tierSame` })
      }
      seen.add(row.days)
    })
    const sorted = numbers
      .map((row, index) => ({ ...row, index }))
      .filter((row) => row.days !== null && row.percent !== null)
      .sort((a, b) => (b.days ?? 0) - (a.days ?? 0))
    sorted.forEach((row, position) => {
      const before = sorted[position - 1]
      if (before && (row.percent ?? 0) < (before.percent ?? 0)) {
        ctx.addIssue({
          code: "custom",
          path: [row.index, "fee_percent"],
          message: `${F}.tierOrder`,
        })
      }
    })
  })

/** Stored tiers as rows, the most days first. */
export const tierDraftsOf = (tiers: readonly CancellationTier[] | undefined): TierDraft[] =>
  [...(tiers ?? [])]
    .sort((a, b) => b.days_before - a.days_before)
    .map((tier) => ({
      days_before: String(tier.days_before),
      fee_percent: String(tier.fee_percent),
    }))

/** Rows to save, the most days first. */
export const tiersInputOf = (rows: readonly TierDraft[]): CancellationTier[] =>
  rows
    .map((row) => ({
      days_before: parseCountInput(row.days_before) ?? 0,
      fee_percent: parseCountInput(row.fee_percent) ?? 0,
    }))
    .sort((a, b) => b.days_before - a.days_before)

/** A new row: a day under the last one, keeping at least what it keeps. */
export function nextTier(rows: readonly TierDraft[]): TierDraft {
  const last = numbersOf(rows).at(-1)
  const days = last?.days ?? null
  if (days === null) {
    return { days_before: "30", fee_percent: "0" }
  }
  return {
    days_before: String(Math.max(0, Math.floor(days / 2))),
    fee_percent: String(Math.min(TIER_LIMITS.percent, (last?.percent ?? 0) + 25)),
  }
}
