import { randomBytes } from "node:crypto"
import { safeEqual } from "../../security"

/**
 * The shop's BirFatura connection token (adr/0072 §3): made here, shown
 * once, typed into BirFatura's "API Şifresi" field, and sent back by
 * BirFatura in the `token` header of each call.
 */

/** A GUID's shape, as BirFatura asks for one ("GUID token"). */
export const BIRFATURA_TOKEN_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

/**
 * 128 random bits written as a GUID. Not a v4 UUID: no bit is spent on a
 * version, so every one of the 128 is a guess an attacker has to make.
 */
export function newBirfaturaToken(random: (size: number) => Buffer = randomBytes): string {
  const hex = random(16).toString("hex")
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20, 32),
  ].join("-")
}

/**
 * The `token` header as sent: trimmed, lower case (a GUID's letters are a
 * case away from each other's); "" when missing or not a string. Sent twice,
 * Node joins the values as "a, b": that is no GUID and matches nothing.
 * Never read from the query or the body.
 */
export function tokenFromHeader(header: string | string[] | undefined): string {
  return typeof header === "string" ? header.trim().toLowerCase() : ""
}

/**
 * Whether the header's token is the stored one, in constant time: both
 * sides are hashed to equal length first (`safeEqual`). A missing header
 * is compared all the same, so a wrong token and none take the same time;
 * no stored token matches nothing.
 */
export function birfaturaTokenMatches(given: string, stored: string | null | undefined): boolean {
  const matched = safeEqual(given, stored ?? "")
  return matched && given.length > 0
}
