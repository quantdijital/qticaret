import { INTERNAL_ERROR_BODY, classifyDbMessage } from "@qticaret/server-kit"
import type { DbErrorKind } from "@qticaret/server-kit"
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
  /** A plan limit refusal (`plan.limit_reached`, adr/0061 Ek C14): which, used, allowed. */
  limit?: string
  used?: number
  max?: number
  /** A write the shop's status closes (`plan.restricted`, adr/0061 Ek C15): `restricted` or `suspended`. */
  status?: string
}

// The classification and the 5xx body live in server-kit, shared with the
// control plane's handler (adr/0061 Ek C19 M1)
export { INTERNAL_ERROR_BODY, classifyDbMessage }
export type { DbErrorKind }

const DB_MESSAGE_KEYS: Record<DbErrorKind, string> = {
  duplicate: "errors.duplicate",
  invalid_reference: "errors.invalid_reference",
  not_null: DEFAULT_VALIDATION_MESSAGE,
  unknown_column: DEFAULT_VALIDATION_MESSAGE,
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
