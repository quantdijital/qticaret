import { z } from "zod"
import {
  formatMoneyInput,
  parseCountInput,
  parseMoneyInput,
} from "@qticaret/admin-ui/lib/money-input"
import { TRAVELER_LEVELS } from "@/features/products/api/booking"
import type {
  Bookable,
  BookableSettingsInput,
  BookingSlot,
  PaxEntry,
} from "@/features/products/api/booking"
import { tierDraftsOf, tiersInputOf, tiersSchema } from "./cancel-tiers"
import { recurringStarts, zonedIso } from "./slot-dates"

const F = "products.booking.errors.form"

/** The server's limits (`lib/booking/settings.ts`, slot validators). */
export const BOOKING_LIMITS = {
  capacity: 10_000,
  cutoffHours: 24 * 60,
  holdMin: 10,
  holdMax: 60,
  maxUnits: 500,
  minParticipants: 10_000,
  pax: 20,
  age: 120,
  adjustment: 1_000_000,
} as const

const countIn = (text: string, min: number, max: number): boolean => {
  const value = parseCountInput(text)
  return value !== null && value >= min && value <= max
}

/** A difference in lira, "-" for cheaper ("-150,50"); null when unreadable. */
export function signedMoney(text: string): number | null {
  const trimmed = text.trim()
  const negative = trimmed.startsWith("-")
  const value = parseMoneyInput(negative ? trimmed.slice(1) : trimmed)
  return value === null ? null : negative ? -value : value
}

const capacityText = z
  .string()
  .refine((text) => countIn(text, 1, BOOKING_LIMITS.capacity), `${F}.capacity`)

/** One departure: its start on the zone's clock, in the future, and its places. */
export const slotDraftSchema = (zone: string, now: () => Date = () => new Date()) =>
  z.object({
    starts_at: z.string().superRefine((local, ctx) => {
      const iso = zonedIso(local, zone)
      if (iso === null) {
        ctx.addIssue({ code: "custom", message: `${F}.start` })
      } else if (new Date(iso) <= now()) {
        ctx.addIssue({ code: "custom", message: `${F}.past` })
      }
    }),
    capacity: capacityText,
  })
export type SlotDraft = z.infer<ReturnType<typeof slotDraftSchema>>

/** A repeating rule: days of the week at a time, between two days, each with the same places. */
export const recurringSchema = (zone: string, now: () => Date = () => new Date()) =>
  z
    .object({
      from: z.string().min(1, `${F}.from`),
      to: z.string().min(1, `${F}.to`),
      weekdays: z.array(z.number().int().min(0).max(6)).min(1, `${F}.weekdays`),
      time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, `${F}.time`),
      capacity: capacityText,
    })
    .superRefine((rule, ctx) => {
      if (rule.from && rule.to && rule.from > rule.to) {
        ctx.addIssue({ code: "custom", path: ["to"], message: `${F}.range` })
      } else if (recurringStarts({ ...rule, zone, now: now() }).starts.length === 0) {
        ctx.addIssue({ code: "custom", path: ["weekdays"], message: `${F}.noStarts` })
      }
    })
export type RecurringDraft = z.infer<ReturnType<typeof recurringSchema>>

/** A departure's own edit: places not under what is sold and held, a difference per variant. */
export const slotEditSchema = (minCapacity: number) =>
  z.object({
    capacity: z
      .string()
      .refine((text) => countIn(text, 0, BOOKING_LIMITS.capacity), `${F}.capacity`)
      .refine(
        (text) => (parseCountInput(text) ?? 0) >= minCapacity,
        "products.booking.errors.capacityBelowSold"
      ),
    adjustments: z.record(
      z.string(),
      z.string().refine((text) => {
        if (text.trim() === "") {
          return true
        }
        const value = signedMoney(text)
        return value !== null && Math.abs(value) <= BOOKING_LIMITS.adjustment
      }, `${F}.adjustment`)
    ),
  })
export type SlotEditDraft = z.infer<ReturnType<typeof slotEditSchema>>

export const slotEditDraftOf = (slot: BookingSlot): SlotEditDraft => ({
  capacity: String(slot.capacity),
  adjustments: Object.fromEntries(
    Object.entries(slot.price_adjustments ?? {}).map(([variant, lira]) => [
      variant,
      formatMoneyInput(lira),
    ])
  ),
})

/** The differences to send: empty and zero ones dropped, none left → null (clears them). */
export function adjustmentsOf(draft: SlotEditDraft): Record<string, number> | null {
  const entries = Object.entries(draft.adjustments).flatMap(
    ([variant, text]): [string, number][] => {
      const value = text.trim() === "" ? null : signedMoney(text)
      return value === null || value === 0 ? [] : [[variant, value]]
    }
  )
  return entries.length === 0 ? null : Object.fromEntries(entries)
}

const optionalCount = (min: number, max: number, message: string) =>
  z.string().refine((text) => text.trim() === "" || countIn(text, min, max), message)

/** The product's booking settings; the kinds of person by variant. */
export const settingsSchema = z.object({
  cutoff_hours: z
    .string()
    .refine((text) => countIn(text, 0, BOOKING_LIMITS.cutoffHours), `${F}.cutoff`),
  hold_minutes: z
    .string()
    .refine(
      (text) => countIn(text, BOOKING_LIMITS.holdMin, BOOKING_LIMITS.holdMax),
      "products.booking.errors.holdMinutes"
    ),
  max_units_per_cart: z
    .string()
    .refine((text) => countIn(text, 1, BOOKING_LIMITS.maxUnits), `${F}.maxUnits`),
  min_participants: optionalCount(1, BOOKING_LIMITS.minParticipants, `${F}.minParticipants`),
  traveler_level: z.enum(TRAVELER_LEVELS),
  tiers: tiersSchema,
  pax: z.record(
    z.string(),
    z
      .object({
        pax: z.string().refine((text) => countIn(text, 0, BOOKING_LIMITS.pax), `${F}.pax`),
        min_age: optionalCount(0, BOOKING_LIMITS.age, `${F}.age`),
        max_age: optionalCount(0, BOOKING_LIMITS.age, `${F}.age`),
      })
      .refine(
        (entry) =>
          entry.min_age.trim() === "" ||
          entry.max_age.trim() === "" ||
          (parseCountInput(entry.min_age) ?? 0) <= (parseCountInput(entry.max_age) ?? 0),
        { path: ["max_age"], message: "products.booking.errors.paxAges" }
      )
  ),
})
export type SettingsDraft = z.infer<typeof settingsSchema>

export function settingsDraftOf(
  bookable: Bookable | null,
  variants: readonly { id: string }[]
): SettingsDraft {
  const ageText = (age: number | undefined) => (age === undefined ? "" : String(age))
  return {
    cutoff_hours: String(bookable?.cutoff_hours ?? 0),
    hold_minutes: String(bookable?.hold_minutes ?? 20),
    max_units_per_cart: String(bookable?.max_units_per_cart ?? 20),
    min_participants:
      bookable?.min_participants === null || bookable?.min_participants === undefined
        ? ""
        : String(bookable.min_participants),
    traveler_level: bookable?.traveler_fields?.level ?? "none",
    tiers: tierDraftsOf(bookable?.cancellation_tiers),
    pax: Object.fromEntries(
      variants.map((variant) => {
        const entry = bookable?.pax_by_variant[variant.id]
        return [
          variant.id,
          {
            pax: String(entry?.pax ?? 1),
            min_age: ageText(entry?.min_age),
            max_age: ageText(entry?.max_age),
          },
        ]
      })
    ),
  }
}

/** The settings to save; a variant counting one with no ages is left out (the server's default). */
export function settingsInputOf(draft: SettingsDraft): BookableSettingsInput {
  const count = (text: string) => parseCountInput(text) ?? 0
  const pax = Object.fromEntries(
    Object.entries(draft.pax).flatMap(([variant, entry]): [string, PaxEntry][] => {
      const value: PaxEntry = {
        pax: count(entry.pax),
        ...(entry.min_age.trim() === "" ? {} : { min_age: count(entry.min_age) }),
        ...(entry.max_age.trim() === "" ? {} : { max_age: count(entry.max_age) }),
      }
      const plain = value.pax === 1 && value.min_age === undefined && value.max_age === undefined
      return plain ? [] : [[variant, value]]
    })
  )
  return {
    cutoff_hours: count(draft.cutoff_hours),
    hold_minutes: count(draft.hold_minutes),
    max_units_per_cart: count(draft.max_units_per_cart),
    min_participants: draft.min_participants.trim() === "" ? null : count(draft.min_participants),
    pax_by_variant: pax,
    traveler_fields: { level: draft.traveler_level },
    cancellation_tiers: tiersInputOf(draft.tiers),
  }
}
