import { z } from "@medusajs/framework/zod"

/**
 * A dated product's booking settings as the API takes and gives them
 * (adr/0076 §3, §4, §7, §8). The JSON ones are kept as these shapes;
 * `traveler_fields` and `cancellation_tiers` are read by later slices
 * (D6, D7) and only stored now, with their defaults.
 */

// Medusa IDs are short
const id = z.string().min(1).max(64)

/**
 * Which traveler details checkout asks for, each level adding to the one
 * before (§7): none, the name, + birth date, + ID or passport number, +
 * nationality. No ID images, at any level.
 */
export const TRAVELER_LEVELS = ["none", "name", "birth_date", "identity", "nationality"] as const

export const TravelerFields = z.object({ level: z.enum(TRAVELER_LEVELS) }).strict()
export type TravelerFieldsType = z.infer<typeof TravelerFields>
export const DEFAULT_TRAVELER_FIELDS: TravelerFieldsType = { level: "none" }

/** "N days or more before the date, X% is kept" (§8); at most ten, one per day count. */
export const CancellationTiers = z
  .array(
    z
      .object({
        days_before: z.number().int().min(0).max(365),
        fee_percent: z.number().int().min(0).max(100),
      })
      .strict()
  )
  .max(10)
  .refine((tiers) => new Set(tiers.map((tier) => tier.days_before)).size === tiers.length, {
    message: "booking.cancellation_tiers_invalid",
  })
export type CancellationTiersType = z.infer<typeof CancellationTiers>

/**
 * Per variant (a price category, §4): how many places a unit takes (an
 * infant 0, a family ticket 4) and the ages it is for. A variant left out
 * takes one place.
 */
export const PaxByVariant = z
  .record(
    id,
    z
      .object({
        pax: z.number().int().min(0).max(20),
        min_age: z.number().int().min(0).max(120).optional(),
        max_age: z.number().int().min(0).max(120).optional(),
      })
      .strict()
      .refine(
        (entry) =>
          entry.min_age === undefined ||
          entry.max_age === undefined ||
          entry.min_age <= entry.max_age,
        { message: "booking.pax_ages_invalid" }
      )
  )
  .refine((record) => Object.keys(record).length <= 100, { message: "booking.pax_invalid" })
export type PaxByVariantType = z.infer<typeof PaxByVariant>

/** IANA zone names the runtime knows (`Europe/Istanbul`). */
export const TimeZone = z
  .string()
  .min(1)
  .max(64)
  .refine(
    (zone) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: zone })
        return true
      } catch {
        return false
      }
    },
    { message: "booking.timezone_invalid" }
  )

/** The settings a save may send; absent ones keep their values. */
export const BookableSettings = z
  .object({
    cutoff_hours: z
      .number()
      .int()
      .min(0)
      .max(24 * 60)
      .optional(),
    hold_minutes: z.number().int().min(10).max(60).optional(),
    max_units_per_cart: z.number().int().min(1).max(500).optional(),
    min_participants: z.number().int().min(1).max(10_000).nullable().optional(),
    traveler_fields: TravelerFields.optional(),
    cancellation_tiers: CancellationTiers.optional(),
    pax_by_variant: PaxByVariant.optional(),
    timezone: TimeZone.optional(),
  })
  .strict()
export type BookableSettingsType = z.infer<typeof BookableSettings>

/**
 * A difference on a variant's price for one departure, in lira to the
 * kuruş (negative: cheaper), a million at most either way; kept in kuruş.
 */
const adjustment = z
  .number()
  .refine(
    (value) =>
      Math.abs(value) <= 1_000_000 && Math.abs(value * 100 - Math.round(value * 100)) < 1e-6,
    { message: "booking.price_adjustment_invalid" }
  )

export const PriceAdjustments = z
  .record(id, adjustment)
  .refine((record) => Object.keys(record).length <= 100, {
    message: "booking.price_adjustment_invalid",
  })

/** Lira to kuruş, for the slot's stored differences. */
export const adjustmentsInKurus = (
  lira: Record<string, number> | null
): Record<string, number> | null =>
  lira === null
    ? null
    : Object.fromEntries(Object.entries(lira).map(([key, value]) => [key, Math.round(value * 100)]))

/** Kuruş back to lira, as the API gives them. */
export const adjustmentsInLira = (
  kurus: Record<string, number> | null | undefined
): Record<string, number> | null =>
  kurus ? Object.fromEntries(Object.entries(kurus).map(([key, value]) => [key, value / 100])) : null
