import { z } from "zod"
import type { FoundTraveler, TravelerSearch } from "@/features/customers/api/traveler-requests"

const R = "customers.travelerRequests"

/** A traveler's KVKK request's search form (adr/0076 Ek D6b); the server checks it again. */
export const searchSchema = z.object({
  first_name: z.string().trim().min(1, `${R}.errors.firstName`).max(100, `${R}.errors.firstName`),
  last_name: z.string().trim().min(1, `${R}.errors.lastName`).max(100, `${R}.errors.lastName`),
  birth_date: z.string(),
  document_no: z.string().max(40, `${R}.errors.document`),
})
export type SearchDraft = z.infer<typeof searchSchema>

export const EMPTY_SEARCH: SearchDraft = {
  first_name: "",
  last_name: "",
  birth_date: "",
  document_no: "",
}

/**
 * What to warn of before a copy or a deletion (security review O1): a
 * name alone, or more than one row, may be other people of that name
 * (`narrow`: ask for the birth date or the number); rows holding more
 * than one birth date or nationality surely are (`mixed`, and which of
 * the two differ, to mark them on each row).
 */
export function searchWarnings(asked: TravelerSearch, rows: readonly FoundTraveler[]) {
  const byNameOnly = !asked.birth_date && !asked.document_no
  const differ = (values: (string | null)[]) => new Set(values.filter(Boolean)).size > 1
  const birthDates = differ(rows.map((row) => row.birth_date))
  const nationalities = differ(rows.map((row) => row.nationality))
  return {
    narrow: rows.length > 1 || (byNameOnly && rows.length > 0),
    mixed: birthDates || nationalities,
    birthDates,
    nationalities,
  }
}
export type SearchWarnings = ReturnType<typeof searchWarnings>

/** What the form sends: empty optional fields left out. */
export function searchOf(draft: SearchDraft): TravelerSearch {
  return {
    first_name: draft.first_name.trim(),
    last_name: draft.last_name.trim(),
    ...(draft.birth_date.trim() ? { birth_date: draft.birth_date.trim() } : {}),
    ...(draft.document_no.trim() ? { document_no: draft.document_no.trim() } : {}),
  }
}
