import { ValidationError } from "../errors"
import { isCleanText } from "../security/text"
import { TRAVELER_LEVELS, TravelerFields } from "./settings"

/**
 * Travelers on a dated product (adr/0076 §7, K8): what a product asks of
 * each, the checks a shopper's entries pass and how a stored number shows.
 * Pure; the module keeps the rows, the workflows decide when.
 */

export type TravelerLevel = (typeof TRAVELER_LEVELS)[number]

/** The fields beyond the name and the level that first asks each (the levels add up). */
const FIELD_LEVEL = {
  birth_date: "birth_date",
  document_no: "identity",
  nationality: "nationality",
} as const satisfies Record<string, TravelerLevel>

export type TravelerField = keyof typeof FIELD_LEVEL

const rank = (level: TravelerLevel): number => TRAVELER_LEVELS.indexOf(level)

/** The product's level (`bookable.traveler_fields`); anything unreadable asks nothing. */
export function levelOf(travelerFields: unknown): TravelerLevel {
  const parsed = TravelerFields.safeParse(travelerFields)
  return parsed.success ? parsed.data.level : "none"
}

/** Whether a product at `level` asks for `field`. */
export const asks = (level: TravelerLevel, field: TravelerField): boolean =>
  level !== "none" && rank(level) >= rank(FIELD_LEVEL[field])

/** How long a traveler's row is kept after the service's date (a proposal; adr/0076 Ek D6). */
export const TRAVELER_KEEP_DAYS = 180
/** A cart's travelers that never became a booking: gone after this, the order's evidence kept. */
export const UNBOOKED_TRAVELER_DAYS = 2
// The most travelers one cart sends; past this, a typo, not a group
export const MAX_TRAVELERS = 200

const DAY = 24 * 60 * 60 * 1000

/** When a traveler on a departure is deleted: its end (or start) plus the period kept. */
export const purgeAfterOf = (startsAt: Date, endsAt: Date | null): Date =>
  new Date((endsAt ?? startsAt).getTime() + TRAVELER_KEEP_DAYS * DAY)

/** A departure the cart books and what it asks: `count` travelers at `level`. */
export interface TravelerNeed {
  slot_id: string
  level: TravelerLevel
  count: number
}

/** One traveler as the storefront sends it. */
export interface TravelerInput {
  slot_id: string
  first_name: string
  last_name: string
  birth_date?: string | undefined
  document_no?: string | undefined
  nationality?: string | undefined
}

/** One traveler checked: trimmed, upper-cased where it is a code, placed by its order. */
export interface CleanTraveler {
  slot_id: string
  position: number
  first_name: string
  last_name: string
  birth_date: string | null
  document_no: string | null
  nationality: string | null
}

/** A name as kept: spaces collapsed, 1–100 characters, no control characters; null if not. */
export function cleanName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ")
  return name.length >= 1 && name.length <= 100 && isCleanText(name) ? name : null
}

/** An ID or passport number as kept: upper case, no spaces or dashes, 5–20 letters and digits. */
export function cleanDocument(value: string): string | null {
  const number = value.replace(/[\s-]+/g, "").toUpperCase()
  return /^[A-Z0-9]{5,20}$/.test(number) ? number : null
}

const regionNames = new Intl.DisplayNames(["en"], { type: "region", fallback: "code" })

/** An ISO 3166-1 alpha-2 country the runtime knows (`TR`, `DE`); null if not. */
export function cleanCountry(value: string): string | null {
  const code = value.trim().toUpperCase()
  if (!/^[A-Z]{2}$/.test(code)) {
    return null
  }
  // Unknown codes come back as themselves
  return regionNames.of(code) !== code ? code : null
}

/** A birth date `YYYY-MM-DD`, a real day, not after today and at most 120 years back. */
export function cleanBirthDate(value: string, now: Date): string | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return null
  }
  const date = new Date(`${value}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) {
    return null
  }
  const oldest = Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate())
  return date.getTime() <= now.getTime() && date.getTime() >= oldest ? value : null
}

const refuse = (field: string): never => {
  throw new ValidationError("booking.travelers_invalid", { field })
}

function cleanOne(
  input: TravelerInput,
  level: TravelerLevel,
  index: number,
  position: number,
  now: Date
): CleanTraveler {
  const at = (field: string) => `travelers.${String(index)}.${field}`
  const optional = <T>(
    field: TravelerField,
    value: string | undefined,
    clean: (text: string) => T | null
  ): T | null => {
    if (!asks(level, field)) {
      // Only what the product asks is taken (KVKK: no more than needed)
      return value === undefined ? null : refuse(at(field))
    }
    return value === undefined ? refuse(at(field)) : (clean(value) ?? refuse(at(field)))
  }
  return {
    slot_id: input.slot_id,
    position,
    first_name: cleanName(input.first_name) ?? refuse(at("first_name")),
    last_name: cleanName(input.last_name) ?? refuse(at("last_name")),
    birth_date: optional("birth_date", input.birth_date, (text) => cleanBirthDate(text, now)),
    document_no: optional("document_no", input.document_no, cleanDocument),
    nationality: optional("nationality", input.nationality, cleanCountry),
  }
}

/**
 * The shopper's travelers checked against what the cart's departures ask:
 * for each departure asking any, exactly its places' worth (Σ quantity ×
 * pax, worked out on the server), each with the fields its level asks and
 * none other; a traveler on a departure that asks nothing or is not in the
 * cart is refused. 400 `booking.travelers_invalid` with the field.
 */
export function checkTravelers(
  needs: readonly TravelerNeed[],
  inputs: readonly TravelerInput[],
  now: Date = new Date()
): CleanTraveler[] {
  const asked = new Map(needs.filter((need) => need.level !== "none").map((n) => [n.slot_id, n]))
  const seen = new Map<string, number>()
  const result = inputs.map((input, index) => {
    const need = asked.get(input.slot_id) ?? refuse(`travelers.${String(index)}.slot_id`)
    const position = seen.get(input.slot_id) ?? 0
    seen.set(input.slot_id, position + 1)
    return cleanOne(input, need.level, index, position, now)
  })
  for (const need of asked.values()) {
    if ((seen.get(need.slot_id) ?? 0) !== need.count) {
      refuse("travelers")
    }
  }
  return result
}

/** A stored traveler as completeness reads it (no number, only whether there is one). */
export interface StoredTraveler {
  slot_id: string
  birth_date: string | null
  nationality: string | null
  document_last4: string | null
}

/**
 * Whether the stored travelers still answer what the cart asks now (its
 * places or the product's level may have changed since they were sent).
 */
export function travelersComplete(
  needs: readonly TravelerNeed[],
  stored: readonly StoredTraveler[]
): boolean {
  return needs
    .filter((need) => need.level !== "none" && need.count > 0)
    .every((need) => {
      const rows = stored.filter((row) => row.slot_id === need.slot_id)
      return (
        rows.length === need.count &&
        rows.every(
          (row) =>
            (!asks(need.level, "birth_date") || row.birth_date !== null) &&
            (!asks(need.level, "document_no") || row.document_last4 !== null) &&
            (!asks(need.level, "nationality") || row.nationality !== null)
        )
      )
    })
}

/** A number as staff and the shopper see it: its last four only (two of a short one). */
export const maskDocument = (last4: string | null): string | null =>
  last4 === null ? null : `***${last4}`
