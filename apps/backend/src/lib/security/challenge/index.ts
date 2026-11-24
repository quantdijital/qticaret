import { createHash, randomBytes } from "node:crypto"
import { hashPii, safeEqual } from "@qticaret/server-kit"
import type { TurnstileGate } from "../turnstile"

/**
 * A proof of work the visitor's browser does instead of a picture puzzle
 * (F15.6, adr/0044 §1): find a `nonce` that makes SHA-256(salt + nonce)
 * start with `bits` zero bits. Cheap once, costly a thousand times. The
 * challenge is stateless, signed with the shop's keyed hash; its single
 * use is the caller's (a short-lived key in the shared store).
 */

export const CHALLENGE_SCOPES = [
  "register",
  "login",
  // A staff member's sign-in: its challenges are never a shopper's (the F15 review)
  "staff_login",
  "order_lookup",
  "stock_alert",
  "checkout",
  // F18 D10 (adr/0047): the storefront's contact form
  "contact",
  // F18: the storefront's newsletter box (each sends a confirmation e-mail)
  "newsletter",
  // adr/0025 Ek 2026-11-03: a gift card's balance asked by its code (a guess at a code)
  "gift_card",
] as const
export type ChallengeScope = (typeof CHALLENGE_SCOPES)[number]

/**
 * The proof asked in Turnstile's stead while Cloudflare cannot answer (adr/0044
 * Ek 2026-11-24): a scope of its own per gate, so a proof given past an
 * adaptive limit never stands for Turnstile at a gate that always asks it.
 */
export type FallbackScope = `ts_${TurnstileGate}`
export type AnyChallengeScope = ChallengeScope | FallbackScope
export const fallbackScope = (gate: TurnstileGate): FallbackScope => `ts_${gate}`

export const CHALLENGE_TTL_MS = 5 * 60 * 1000
// About 260,000 tries on average: under a second on a phone
export const BASE_BITS = 18
const MIN_BITS = 10
const MAX_BITS = 24
const PURPOSE = "fraud.challenge"
const SALT = /^[A-Za-z0-9_-]{22}$/
const NONCE = /^\d{1,12}$/

export interface Challenge {
  token: string
  salt: string
  bits: number
  expires_at: string
}

export type ChallengeCheck =
  | { ok: true; key: string; until: number }
  | { ok: false; reason: "malformed" | "forged" | "expired" | "scope" | "weak" | "unsolved" }

const signed = (body: string, key: Buffer) => hashPii(body, key, PURPOSE)

/** A new challenge for the scope; `bits` held to the bounds. */
export function issueChallenge(
  scope: AnyChallengeScope,
  key: Buffer,
  bits: number = BASE_BITS,
  now: number = Date.now()
): Challenge {
  const salt = randomBytes(16).toString("base64url")
  const hard = Math.min(MAX_BITS, Math.max(MIN_BITS, Math.round(bits)))
  const until = now + CHALLENGE_TTL_MS
  const body = `${scope}.${salt}.${String(hard)}.${String(until)}`
  return {
    token: `${body}.${signed(body, key)}`,
    salt,
    bits: hard,
    expires_at: new Date(until).toISOString(),
  }
}

/** Whether the digest of salt and nonce starts with `bits` zero bits. */
export function solves(salt: string, nonce: string, bits: number): boolean {
  const digest = createHash("sha256").update(`${salt}${nonce}`, "utf8").digest()
  const whole = Math.floor(bits / 8)
  for (let index = 0; index < whole; index++) {
    if (digest[index] !== 0) {
      return false
    }
  }
  const rest = bits % 8
  return rest === 0 || (digest[whole] ?? 0xff) >> (8 - rest) === 0
}

/** The answer a browser finds, here for tests and the development checkout page. */
export function solveChallenge(salt: string, bits: number): string {
  for (let nonce = 0; ; nonce++) {
    if (solves(salt, String(nonce), bits)) {
      return String(nonce)
    }
  }
}

/**
 * Checks `X-Challenge: <token>.<nonce>` for the scope, at least as hard as
 * `minBits` (what is asked now: a challenge given when less was asked does
 * not answer a harder ask). A good one returns the key its single use is
 * kept under, and until when.
 */
export function checkChallenge(
  header: string,
  scope: AnyChallengeScope,
  key: Buffer,
  now: number = Date.now(),
  minBits: number = MIN_BITS
): ChallengeCheck {
  const parts = header.trim().split(".")
  if (parts.length !== 6) {
    return { ok: false, reason: "malformed" }
  }
  const [given = "", salt = "", bitsText = "", untilText = "", signature = "", nonce = ""] = parts
  if (!SALT.test(salt) || !/^\d{2}$/.test(bitsText) || !/^\d{13}$/.test(untilText)) {
    return { ok: false, reason: "malformed" }
  }
  if (!NONCE.test(nonce)) {
    return { ok: false, reason: "malformed" }
  }
  const body = `${given}.${salt}.${bitsText}.${untilText}`
  if (!safeEqual(signature, signed(body, key))) {
    return { ok: false, reason: "forged" }
  }
  const until = Number(untilText)
  if (until < now) {
    return { ok: false, reason: "expired" }
  }
  if (given !== scope) {
    return { ok: false, reason: "scope" }
  }
  if (Number(bitsText) < minBits) {
    return { ok: false, reason: "weak" }
  }
  if (!solves(salt, nonce, Number(bitsText))) {
    return { ok: false, reason: "unsolved" }
  }
  return { ok: true, key: signed(`used.${salt}`, key).slice(0, 32), until }
}
