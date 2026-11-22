import type { OptionView } from "./checkout-views"
import type { ActionResult } from "./theme"

/**
 * The checkout's travelers step (adr/0076 §7, Ek D6b): a dated product
 * may ask, for each place booked, the traveler's name and, level by level,
 * their birth date, ID or passport number and nationality. How many and
 * which fields are the server's; a theme draws them and sends them back.
 * A theme without this step draws no `travelers` step (the payment's start
 * then refuses until they are entered, `booking.travelers_missing`).
 */

/** What a departure asks of each of its travelers; the levels add up. */
export type TravelerLevel = "name" | "birth_date" | "identity" | "nationality"

/** A traveler as entered so far: the number only masked ("***1234"), never sent back. */
export interface TravelerEntryView {
  firstName: string
  lastName: string
  /** `YYYY-MM-DD`, "" when not entered. */
  birthDate: string
  /** ISO 3166-1 alpha-2, "" when not entered. */
  nationality: string
  /** "***1234" when a number was entered; the field itself starts empty. */
  documentMasked: string | null
}

/** One departure in the cart that asks for travelers. */
export interface TravelerGroupView {
  slotId: string
  /** The product's name, in words ("Kapadokya turu"). */
  title: string
  /** The departure in words ("Cumartesi, 12 Aralık 2026 · 09:00"). */
  when: string
  level: TravelerLevel
  /** How many travelers: one form block each (the server's count of places). */
  count: number
  /** As entered so far, by position; fewer than `count` until all are in. */
  people: TravelerEntryView[]
}

export interface TravelersStepView {
  groups: TravelerGroupView[]
  /** Whether what was entered answers every departure now. */
  complete: boolean
  /** The step's summary once done ("3 katılımcı"); null until then. */
  summary: string | null
  /** The nationalities to choose from, by name; Türkiye first. */
  countries: OptionView[]
  /** The latest birth date the form takes (today), `YYYY-MM-DD`. */
  maxBirthDate: string
}

/**
 * The travelers form's answer: the refusal's key, and the field it is
 * about when the storefront knows it (`traveler.<n>.<field>`, n counted
 * across the groups from 0) so the theme can point at it.
 */
export interface TravelersResult extends ActionResult {
  field?: string | null
}

/**
 * Form fields, for each traveler n (from 0, across the groups in order):
 * `traveler.<n>.slot_id`, `traveler.<n>.first_name`, `traveler.<n>.last_name`
 * and, as the group's level asks, `traveler.<n>.birth_date` (`YYYY-MM-DD`),
 * `traveler.<n>.document_no`, `traveler.<n>.nationality`. Nothing priced.
 */
export type SaveTravelers = (state: TravelersResult, form: FormData) => Promise<TravelersResult>
