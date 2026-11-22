import type { TravelerLevel } from "@qticaret/ui"
import type { TravelerInput } from "@/lib/booking/travelers"

/**
 * The travelers form's fields (adr/0076 Ek D6b; `SaveTravelers` in
 * `@qticaret/ui`): `traveler.<n>.<field>`, n from 0 across the departures.
 * What each departure asks is its level (read from the backend): a field
 * it asks must be filled, one it does not is not sent. Without the levels
 * a field in the form is taken as asked. The same rules as the backend's, so a
 * mistake is named by its field here (the backend's refusal names none).
 */

// The most travelers one cart sends (the backend's own limit)
const MOST = 200
const SLOT_ID = /^bkslot_[0-9A-Za-z]{10,64}$/
const NAME =
  /^traveler\.(\d{1,3})\.(slot_id|first_name|last_name|birth_date|document_no|nationality)$/
// eslint-disable-next-line no-control-regex -- control characters are what is refused
const CONTROL = /[\u0000-\u001f\u007f-\u009f]/

type Field = "slot_id" | "first_name" | "last_name" | "birth_date" | "document_no" | "nationality"

export type ParsedTravelers =
  { ok: true; travelers: TravelerInput[] } | { ok: false; error: string; field: string | null }

/** A name as the backend keeps it: spaces collapsed, 1–100 characters, no control characters. */
export function cleanName(value: string): string | null {
  const name = value.trim().replace(/\s+/g, " ")
  return name.length >= 1 && name.length <= 100 && !CONTROL.test(name) ? name : null
}

/** An ID or passport number: spaces and dashes dropped, upper case, 5–20 letters and digits. */
export function cleanDocument(value: string): string | null {
  const number = value.replace(/[\s-]+/g, "").toUpperCase()
  return /^[A-Z0-9]{5,20}$/.test(number) ? number : null
}

/** A birth date `YYYY-MM-DD`: a real day, not after today, at most 120 years back (UTC). */
export function cleanBirthDate(value: string, now: Date): string | null {
  const text = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return null
  }
  const date = new Date(`${text}T00:00:00Z`)
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    return null
  }
  const oldest = Date.UTC(now.getUTCFullYear() - 120, now.getUTCMonth(), now.getUTCDate())
  return date.getTime() <= now.getTime() && date.getTime() >= oldest ? text : null
}

/** A nationality: two letters (the backend checks it names a country). */
export const cleanCountry = (value: string): string | null => {
  const code = value.trim().toUpperCase()
  return /^[A-Z]{2}$/.test(code) ? code : null
}

/** The form's fields by traveler, in their order; null when a field is not one of ours. */
function fieldsOf(form: FormData): Map<number, Partial<Record<Field, string>>> | null {
  const byTraveler = new Map<number, Partial<Record<Field, string>>>()
  for (const [name, value] of form.entries()) {
    if (!name.startsWith("traveler.")) {
      continue
    }
    const match = NAME.exec(name)
    if (!match || typeof value !== "string") {
      return null
    }
    const n = Number(match[1])
    const fields = byTraveler.get(n) ?? {}
    fields[match[2] as Field] = value
    byTraveler.set(n, fields)
  }
  return byTraveler
}

const FAILED = { ok: false, error: "checkout.travelers_failed", field: null } as const

const LEVELS: readonly TravelerLevel[] = ["name", "birth_date", "identity", "nationality"]
// The level that first asks each field beyond the name (the levels add up)
const FIELD_LEVEL = {
  birth_date: "birth_date",
  document_no: "identity",
  nationality: "nationality",
} as const satisfies Record<string, TravelerLevel>

/** Whether a traveler on this departure is asked `field`: by its level, else by the form. */
function asked(
  level: TravelerLevel | undefined,
  field: keyof typeof FIELD_LEVEL,
  fields: Partial<Record<Field, string>>
): boolean {
  return level === undefined
    ? fields[field] !== undefined
    : LEVELS.indexOf(level) >= LEVELS.indexOf(FIELD_LEVEL[field])
}

/**
 * The form's travelers, checked; `levels`: each departure's level by its
 * id (a departure missing from it is refused), null when they could not be read.
 */
export function parseTravelers(
  form: FormData,
  levels: ReadonlyMap<string, TravelerLevel> | null,
  now: Date = new Date()
): ParsedTravelers {
  const byTraveler = fieldsOf(form)
  if (!byTraveler || byTraveler.size === 0 || byTraveler.size > MOST) {
    return FAILED
  }
  const travelers: TravelerInput[] = []
  for (const n of [...byTraveler.keys()].sort((a, b) => a - b)) {
    const fields = byTraveler.get(n) ?? {}
    const at = (field: Field) => `traveler.${String(n)}.${field}`
    const refuse = (error: string, field: Field) =>
      ({ ok: false, error, field: at(field) }) as const
    if (!fields.slot_id || !SLOT_ID.test(fields.slot_id)) {
      return FAILED
    }
    const level = levels?.get(fields.slot_id)
    if (levels && !level) {
      return FAILED
    }
    const first = cleanName(fields.first_name ?? "")
    if (!first) {
      return refuse("checkout.traveler_name_required", "first_name")
    }
    const last = cleanName(fields.last_name ?? "")
    if (!last) {
      return refuse("checkout.traveler_name_required", "last_name")
    }
    const traveler: TravelerInput = { slot_id: fields.slot_id, first_name: first, last_name: last }
    if (asked(level, "birth_date", fields)) {
      const birth = cleanBirthDate(fields.birth_date ?? "", now)
      if (!birth) {
        return refuse("checkout.traveler_birth_date_invalid", "birth_date")
      }
      traveler.birth_date = birth
    }
    if (asked(level, "document_no", fields)) {
      const document = cleanDocument(fields.document_no ?? "")
      if (!document) {
        return refuse("checkout.traveler_document_invalid", "document_no")
      }
      traveler.document_no = document
    }
    if (asked(level, "nationality", fields)) {
      const country = cleanCountry(fields.nationality ?? "")
      if (!country) {
        return refuse("checkout.traveler_nationality_required", "nationality")
      }
      traveler.nationality = country
    }
    travelers.push(traveler)
  }
  return { ok: true, travelers }
}
