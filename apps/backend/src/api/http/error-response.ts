import { DEFAULT_VALIDATION_MESSAGE } from "../../lib/errors"

/**
 * Response bodies Medusa's error mapping produces, made safe to send
 * (docs/04): internals never leave a 5xx, and database messages, which quote
 * column names and row values, are replaced outside the admin API.
 */

export interface ErrorBody {
  code?: string
  type?: string
  message: string
  /** What a validation error's sentence names (`lib/errors` `ValidationError`). */
  values?: Record<string, string>
  /** A provider's failure on the admin API (`provider.failed`): which service, what it said. */
  provider?: string
  provider_message?: string
}

export type DbErrorKind = "duplicate" | "invalid_reference" | "not_null" | "unknown_column"

// Medusa 2.21.2 builds these from Postgres errors: `dbErrorMapper` in the
// service layer, `formatException` in the HTTP error handler. The error code
// is gone by the time the handler runs, so the text is all there is; the unit
// tests generate it with Medusa's own functions to catch template changes.
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

const DB_MESSAGE_KEYS: Record<DbErrorKind, string> = {
  duplicate: "errors.duplicate",
  invalid_reference: "errors.invalid_reference",
  not_null: DEFAULT_VALIDATION_MESSAGE,
  unknown_column: DEFAULT_VALIDATION_MESSAGE,
}

// Database messages are short; a long text is attacker-sized input (an
// echoed path) and is not worth running the patterns over
const MAX_DB_MESSAGE_LENGTH = 1024

export function classifyDbMessage(message: string): DbErrorKind | null {
  if (message.length > MAX_DB_MESSAGE_LENGTH) {
    return null
  }
  return DB_MESSAGES.find(([pattern]) => pattern.test(message))?.[1] ?? null
}

// Medusa's own fixed text for unknown errors, so the admin's toast stays
// readable; clients branch on `type`
export const INTERNAL_ERROR_BODY: Readonly<ErrorBody> = {
  code: "unknown_error",
  type: "unknown_error",
  message: "An unknown error occurred.",
}

// Admin users see Medusa's message: the values are their own input, and a
// clashing SKU or handle has to be named to be fixed (F2 S2 decision).
// Every other prefix, including future ones such as /hooks, is generalised.
const ADMIN_PATH = /^\/admin(\/|$)/

/** The admin API: staff, who also hear which provider failed and what it said. */
export const isAdminPath = (path: string): boolean => ADMIN_PATH.test(path)

export interface SanitizedError {
  status: number
  body: ErrorBody
  /** Set when the message came from the database; log this instead of the text. */
  dbError: DbErrorKind | null
}

export function sanitizeErrorResponse(
  status: number,
  body: ErrorBody,
  path: string
): SanitizedError {
  const dbError = classifyDbMessage(body.message)
  if (status >= 500) {
    return { status, body: { ...INTERNAL_ERROR_BODY }, dbError }
  }
  if (dbError !== null && !ADMIN_PATH.test(path)) {
    return { status, body: { ...body, message: DB_MESSAGE_KEYS[dbError] }, dbError }
  }
  return { status, body, dbError }
}
