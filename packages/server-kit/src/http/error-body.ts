/**
 * What both apps' error handlers share (docs/04, adr/0061 Ek C19 M1): the
 * texts Medusa builds from database errors, which quote column names and
 * row values, and the fixed body every 5xx answers with.
 */

export type DbErrorKind = "duplicate" | "invalid_reference" | "not_null" | "unknown_column"

// Medusa 2.21.2 builds these from Postgres errors: `dbErrorMapper` in the
// service layer, `formatException` in the HTTP error handler. The error code
// is gone by the time the handler runs, so the text is all there is; the
// backend's unit tests generate it with Medusa's own functions to catch
// template changes.
const DB_MESSAGES: readonly (readonly [RegExp, DbErrorKind])[] = [
  // "Customer with email: a@b.c, has_account: true, already exists."
  [/ with .+ already exists\.$/s, "duplicate"],
  // "You tried to set relationship region_id: reg_1, but such entity does not exist"
  [/^You tried to set relationship .*, but such entity does not exist$/s, "invalid_reference"],
  // "Region with id reg_1 does not exist."
  [/^\S+ with \S+ .+ does not exist\.$/s, "invalid_reference"],
  // "Cannot set field 'email' of Customer to null"
  [/^Cannot set field '.+' of .+ to null$/s, "not_null"],
  // "Can't insert null value in field email on insert in table customer"
  [/^Can't insert null value in field .+ on insert in table .+$/s, "not_null"],
  // `column "x" does not exist`
  [/^column .+/s, "unknown_column"],
]

// Database messages are short; a long text is attacker-sized input (an
// echoed path) and is not worth running the patterns over
const MAX_DB_MESSAGE_LENGTH = 1024

export function classifyDbMessage(message: string): DbErrorKind | null {
  if (message.length > MAX_DB_MESSAGE_LENGTH) {
    return null
  }
  return DB_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? null
}

// Medusa's own fixed text for unknown errors, so an admin's toast stays
// readable; clients branch on `type`
export const INTERNAL_ERROR_BODY: Readonly<{ code: string; type: string; message: string }> = {
  code: "unknown_error",
  type: "unknown_error",
  message: "An unknown error occurred.",
}
