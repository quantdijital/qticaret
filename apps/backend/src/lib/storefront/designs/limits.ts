/**
 * How many saved looks a shop keeps (adr/0064 K8, Ek 2026-11-17 §1): ten
 * it names, the latest five taken automatically besides; a document of a
 * megabyte at most (the schema's own limits keep it far below); a name of
 * sixty characters.
 */
export const DESIGN_LIMITS = {
  saved: 10,
  auto: 5,
  bytes: 1_000_000,
  name: 60,
} as const

/** The highest revision number a request may name: the column is a 32-bit integer. */
export const MAX_REVISION = 2_147_483_647

/** A saved look's id as the path and the design's label carry it. */
export const DESIGN_ID = /^sfd_[0-9A-Za-z]{1,40}$/
