import { z } from "@medusajs/framework/zod"
import { SALE_MODES } from "../../modules/booking/models/bookable"

/**
 * A dated product's booking settings as the API takes and gives them
 * (adr/0076 §3, §4, §7, §8). The JSON ones are kept as these shapes.
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
  // Closer to the day never keeps less (D7a): sorted by days, the share only grows
  .refine(
    (tiers) =>
      [...tiers]
        .sort((a, b) => b.days_before - a.days_before)
        .every(
          (tier, index, sorted) =>
            index === 0 || tier.fee_percent >= (sorted[index - 1]?.fee_percent ?? 0)
        ),
    { message: "booking.cancellation_tiers_invalid" }
  )
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

/**
 * IANA zone names the runtime knows, as Area/City (`Europe/Istanbul`,
 * `America/Argentina/Buenos_Aires`). The database reads the zone too
 * (`AT TIME ZONE`, adr/0077 §3), where an offset (`+03:00`) is POSIX and
 * reads with its sign turned, and an abbreviation may mean another zone:
 * neither is taken.
 */
const ZONE_NAME = /^[A-Z][A-Za-z]+(?:\/[A-Za-z0-9][A-Za-z0-9_+-]*){1,2}$/

export const TimeZone = z
  .string()
  .min(1)
  .max(64)
  .regex(ZONE_NAME, { message: "booking.timezone_invalid" })
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
    // adr/0076 Ek D7b: days before a departure its reminder goes; 0 sends none
    reminder_days: z.number().int().min(0).max(30).optional(),
    // adr/0076 Ek 2026-11-23: sold online, by a call-me request, or both
    sale_mode: z.enum(SALE_MODES).optional(),
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
