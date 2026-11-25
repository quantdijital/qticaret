import { MedusaError } from "@medusajs/framework/utils"
import { CLEAN, CLEAN_TEXT } from "../../lib/clean-text"
import { AI_CREDIT_MOVE_MAX } from "../../lib/ai-credits/settings"

/**
 * What the module takes from its callers, checked where the money is
 * kept (adr/0085 "Güvenlik"): text is refused, never cut, when it is too
 * long or carries control or invisible format characters; a credit move
 * has a ceiling; a grant's reference has a shape and the platform's own
 * prefixes are not a caller's to use.
 */

/** A note (a correction's reason, a top-up's remark). */
export const NOTE_MAX = 500
/** A grant's reference and a payment's reference. */
export const REFERENCE_MAX = 256
/** A staff member's or a user's id. */
export const ID_MAX = 128

const invalid = (code: string) => new MedusaError(MedusaError.Types.INVALID_DATA, code)

/**
 * A required single line, trimmed: `cp.ai_credit_<field>_required` when
 * blank, `cp.ai_credit_<field>_invalid` when longer than `max` or unclean.
 */
export function requiredLine(value: string, max: number, field: string): string {
  const trimmed = value.trim()
  if (trimmed === "") {
    throw invalid(`cp.ai_credit_${field}_required`)
  }
  if (trimmed.length > max || !CLEAN.test(trimmed)) {
    throw invalid(`cp.ai_credit_${field}_invalid`)
  }
  return trimmed
}

/** An optional single line, trimmed; blank is null. */
export function optionalLine(
  value: string | null | undefined,
  max: number,
  field: string
): string | null {
  return value === null || value === undefined || value.trim() === ""
    ? null
    : requiredLine(value, max, field)
}

/** A note of one or more lines (at most `NOTE_MAX`); blank is null unless `required`. */
export function noteOf(value: string | null | undefined, required: boolean): string | null {
  const trimmed = value?.trim() ?? ""
  if (trimmed === "") {
    if (required) {
      throw invalid("cp.ai_credit_note_required")
    }
    return null
  }
  if (trimmed.length > NOTE_MAX || !CLEAN_TEXT.test(trimmed)) {
    throw invalid("cp.ai_credit_note_invalid")
  }
  return trimmed
}

/** Credits one top-up or correction moves: a whole number from 1 to `AI_CREDIT_MOVE_MAX`. */
export function movedCredits(value: number): number {
  if (!Number.isSafeInteger(value) || value < 1 || value > AI_CREDIT_MOVE_MAX) {
    throw invalid("cp.ai_credit_amount_invalid")
  }
  return value
}

// The platform writes these itself: the month's grant, a correction, a paid request
const RESERVED_PREFIXES = ["plan:", "adjust:", "order:"] as const
const GRANT_REF = /^[A-Za-z0-9][A-Za-z0-9:._-]*$/

/**
 * A top-up's own reference (a bank transfer's, a staff member's): letters,
 * digits and `:._-`, at most `REFERENCE_MAX`, never one of the platform's
 * prefixes (`cp.ai_credit_grant_ref_reserved`).
 */
export function purchaseRef(value: string): string {
  if (value.length === 0 || value.length > REFERENCE_MAX || !GRANT_REF.test(value)) {
    throw invalid("cp.ai_credit_grant_ref_invalid")
  }
  const lower = value.toLowerCase()
  if (RESERVED_PREFIXES.some((prefix) => lower.startsWith(prefix))) {
    throw invalid("cp.ai_credit_grant_ref_reserved")
  }
  return value
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** A correction's `grant_ref` from the caller's key (a UUID made once per correction). */
export function adjustRef(key: string): string {
  if (!UUID.test(key)) {
    throw invalid("cp.ai_credit_key_invalid")
  }
  return `adjust:${key.toLowerCase()}`
}
