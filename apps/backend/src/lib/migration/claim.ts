import { hashPii, parseKey, safeEqual } from "@qticaret/server-kit"
import { parseEnv } from "../env"

/**
 * The key a moved customer's invitation carries (F14.5, closing review):
 * the moved record it opens, until when, signed with the shop's keyed
 * hash. Only the mailbox the invitation went to has it, so presenting it
 * while signed in proves the moved record is the account's, not only
 * that someone once confirmed the address. Used once (the record is
 * marked adopted).
 */

// An invitation is opened within weeks; past this a new one is sent
export const CLAIM_DAYS = 60
const DAY_MS = 24 * 60 * 60 * 1000
const PURPOSE = "migration.claim"
const ID = /^[A-Za-z0-9_]{1,64}$/

const keyOf = () => parseKey(parseEnv().PII_HASH_KEY, "PII_HASH_KEY")

/** The key for a moved customer record. */
export function claimToken(customerId: string, now: Date = new Date()): string {
  const until = String(now.getTime() + CLAIM_DAYS * DAY_MS)
  return `${customerId}.${until}.${hashPii(`${customerId}.${until}`, keyOf(), PURPOSE)}`
}

/** The moved record a key opens, while it holds; null for anything else. */
export function readClaimToken(token: string, now: Date = new Date()): string | null {
  const [customerId = "", until = "", signature = "", ...rest] = token.split(".")
  if (rest.length > 0 || !ID.test(customerId) || !/^\d{13}$/.test(until)) {
    return null
  }
  const expected = hashPii(`${customerId}.${until}`, keyOf(), PURPOSE)
  if (!safeEqual(signature, expected) || Number(until) < now.getTime()) {
    return null
  }
  return customerId
}
