/**
 * A dated product's length for its card (adr/0077 Ek "tur kartı"): read
 * from its public tour length attribute, a sector pack's "Süre" (travel's
 * `tur-bilgileri` template, a number in days). Nothing is invented: a
 * product without it shows no length.
 */

/** Attribute keys read as a tour's length in days (a sector pack's "Süre"). */
export const DURATION_KEYS: readonly string[] = ["sure"]

/** The longest length a card says; a larger number is a typing slip, not a tour. */
const MOST_DAYS = 365

/** An attribute value as the card facts read it. */
export interface DurationAttributeRow {
  value_number?: unknown
  definition?: { key?: string | null; is_public?: boolean | null; type?: string | null } | null
}

/**
 * The tour's length in whole days from its attribute values, the first
 * key that has one; null without a public whole number from 1 to 365.
 */
export function durationDaysOf(
  attributes: readonly (DurationAttributeRow | null)[] | null | undefined
): number | null {
  for (const key of DURATION_KEYS) {
    const row = (attributes ?? []).find(
      (each) =>
        each?.definition?.key === key &&
        each.definition.is_public !== false &&
        each.definition.type === "number"
    )
    const raw = row?.value_number
    if (raw === null || raw === undefined || raw === "") {
      continue
    }
    const days = Number(raw)
    if (Number.isInteger(days) && days >= 1 && days <= MOST_DAYS) {
      return days
    }
  }
  return null
}
