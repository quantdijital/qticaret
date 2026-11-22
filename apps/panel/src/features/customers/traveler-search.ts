import { z } from "zod"
import type { TravelerSearch } from "@/features/customers/api/traveler-requests"

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

/** What the form sends: empty optional fields left out. */
export function searchOf(draft: SearchDraft): TravelerSearch {
  return {
    first_name: draft.first_name.trim(),
    last_name: draft.last_name.trim(),
    ...(draft.birth_date.trim() ? { birth_date: draft.birth_date.trim() } : {}),
    ...(draft.document_no.trim() ? { document_no: draft.document_no.trim() } : {}),
  }
}
