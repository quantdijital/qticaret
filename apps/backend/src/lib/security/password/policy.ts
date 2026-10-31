import { COMMON_PASSWORDS } from "./common"

/**
 * The password rule (docs/04, adr/0043): length first, as NIST 800-63B
 * asks, no character classes. Counted in characters as a person sees
 * them, not bytes: "ş" is one, so is an emoji.
 */
export const MIN_PASSWORD = 10
// Room for a passphrase; a bound on what the key derivation is handed
export const MAX_PASSWORD = 256
// The part of an address worth refusing inside a password
const MIN_NAME = 4

export type PasswordProblem = "too_short" | "too_long" | "common" | "contains_email"

// One character over and over, or a run of the keyboard's digits, either way and wrapping round
const REPEATED = /^(.)\1+$/u
const DIGITS = "0123456789".repeat(3)
const BACKWARDS = "9876543210".repeat(3)
const LETTERS = new Intl.Segmenter("tr", { granularity: "grapheme" })

/**
 * What is wrong with a new password, or null: too short or too long, one
 * people pick first (or one character repeated, a run of digits), or one
 * holding the address's name. The breach list is asked apart, online.
 */
export function passwordProblem(password: string, email?: string | null): PasswordProblem | null {
  const length = Array.from(LETTERS.segment(password)).length
  if (length < MIN_PASSWORD) {
    return "too_short"
  }
  if (length > MAX_PASSWORD) {
    return "too_long"
  }
  const lower = password.toLocaleLowerCase("tr")
  if (
    COMMON_PASSWORDS.has(lower) ||
    COMMON_PASSWORDS.has(password.toLowerCase()) ||
    REPEATED.test(password) ||
    DIGITS.includes(password) ||
    BACKWARDS.includes(password)
  ) {
    return "common"
  }
  const name = email?.split("@")[0]?.toLocaleLowerCase("tr") ?? ""
  if (name.length >= MIN_NAME && lower.includes(name)) {
    return "contains_email"
  }
  return null
}
