import { isValidationError } from "../errors"

/**
 * A refund's failure marked at the provider boundary as a refusal outright:
 * the provider answered and refused it, or the call never left. Marked on
 * the error itself, as a field, so it survives the workflow that carries
 * it back (security review 2026-11-17, third round O-1). Only the code
 * that made the call knows; a lost answer, one that does not read or is
 * not signed as expected, is never marked.
 */
const REFUSED = "refundRefused"

// The platform client's code for a call that surely never left (`lib/clients/http-client.ts`).
// Not `url_not_allowed`: a redirect refused is reported so too, after the request went (D4-3)
export const NEVER_LEFT: ReadonlySet<string> = new Set(["circuit_open"])

// Our own keys for a refund whose outcome is unknown: never a refusal
const UNCERTAIN_KEYS: ReadonlySet<string> = new Set(["iyzico.refund_outcome_unknown"])

/** Marks `error` a refusal outright and hands it back. */
export function markRefused<T>(error: T): T {
  if (typeof error === "object" && error !== null) {
    Object.assign(error, { [REFUSED]: true })
  }
  return error
}

/**
 * Whether a refund that failed was refused outright, surely not made: an
 * error marked so at the provider boundary, or a check of ours that
 * refused it (a `ValidationError`, ours alone: before the call, or the
 * provider's own refusal in our words), never one whose outcome we say is
 * unknown. Everything else (Medusa's errors included) may hide money gone.
 */
export function refusedOutright(error: unknown): boolean {
  if (typeof error !== "object" || error === null) {
    return false
  }
  if ((error as Record<string, unknown>)[REFUSED] === true) {
    return true
  }
  return isValidationError(error) && !UNCERTAIN_KEYS.has(error.safeMessage)
}
