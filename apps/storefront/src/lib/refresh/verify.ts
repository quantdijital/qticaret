import { createHmac, timingSafeEqual } from "node:crypto"
import { REFRESH_SCOPES } from "./contract"
import type { RefreshScope } from "./contract"

/**
 * The refresh signal's checks (adr/0048 Ek 2026-11-03), in the ADR's
 * order: the time within a minute either way and the body's `at` the
 * same, the nonce's and the scopes' forms, the HMAC-SHA256 of
 * `<time>.<nonce>.<scopes>` under the shared secret (constant time), and
 * the nonce not seen in the last two minutes. Any miss is the same "no".
 */

export const MAX_SKEW_S = 60
export const NONCE_TTL_MS = 2 * 60_000
const NONCE_MAX = 1000

const TIME = /^\d{1,12}$/
const NONCE = /^[0-9a-f]{32}$/
const SIGNATURE = /^[0-9a-f]{64}$/

export interface RefreshSignal {
  time: string | null
  signature: string | null
  body: unknown
}

/** `<time>.<nonce>.<scopes joined by ",">`: what the backend signs. */
export const signedText = (time: string, nonce: string, scopes: readonly string[]): string =>
  `${time}.${nonce}.${scopes.join(",")}`

export const signatureOf = (secret: string, text: string): string =>
  createHmac("sha256", secret).update(text).digest("hex")

const isScope = (value: unknown): value is RefreshScope =>
  typeof value === "string" && (REFRESH_SCOPES as readonly string[]).includes(value)

/** The scopes as sent: 1–6 known names, none twice; null otherwise. */
export function scopesOf(value: unknown): RefreshScope[] | null {
  if (!Array.isArray(value) || value.length === 0 || value.length > REFRESH_SCOPES.length) {
    return null
  }
  if (!value.every(isScope) || new Set(value).size !== value.length) {
    return null
  }
  return value
}

/**
 * Nonces seen in the last two minutes, in this process; pruned as it
 * grows and never more than a thousand. Only a signal whose signature
 * held is written in.
 */
export class NonceLedger {
  private readonly seen = new Map<string, number>()

  constructor(
    private readonly ttlMs = NONCE_TTL_MS,
    private readonly max = NONCE_MAX
  ) {}

  /** True when the nonce is new (and now kept); false when it was seen. */
  claim(nonce: string, now: number): boolean {
    const until = this.seen.get(nonce)
    if (until !== undefined && until > now) {
      return false
    }
    for (const [key, expiry] of this.seen) {
      if (expiry <= now) {
        this.seen.delete(key)
      }
    }
    this.seen.delete(nonce)
    this.seen.set(nonce, now + this.ttlMs)
    // Still too many: the oldest go (a Map keeps insertion order)
    for (const key of this.seen.keys()) {
      if (this.seen.size <= this.max) {
        break
      }
      this.seen.delete(key)
    }
    return true
  }

  get size(): number {
    return this.seen.size
  }
}

/** The scopes to drop when the signal holds; null for any miss. */
export function verifyRefresh(
  signal: RefreshSignal,
  secret: string,
  nowMs: number,
  nonces: NonceLedger
): RefreshScope[] | null {
  const { time, signature } = signal
  if (!time || !TIME.test(time) || Math.abs(Number(time) - nowMs / 1000) > MAX_SKEW_S) {
    return null
  }
  const body = (typeof signal.body === "object" && signal.body !== null ? signal.body : {}) as {
    scopes?: unknown
    at?: unknown
    nonce?: unknown
  }
  if (body.at !== Number(time)) {
    return null
  }
  const nonce = typeof body.nonce === "string" && NONCE.test(body.nonce) ? body.nonce : null
  const scopes = scopesOf(body.scopes)
  if (!nonce || !scopes || !signature || !SIGNATURE.test(signature)) {
    return null
  }
  const expected = Buffer.from(signatureOf(secret, signedText(time, nonce, scopes)), "hex")
  if (!timingSafeEqual(expected, Buffer.from(signature, "hex"))) {
    return null
  }
  return nonces.claim(nonce, nowMs) ? scopes : null
}

/** Signals per address a minute, counted before any signature is checked. */
export class AddressBudget {
  private readonly counts = new Map<string, { count: number; until: number }>()

  constructor(
    private readonly perMinute = 30,
    private readonly max = 1000
  ) {}

  /** True while the address is within its minute's budget. */
  take(address: string, now: number): boolean {
    const hit = this.counts.get(address)
    if (hit && hit.until > now) {
      hit.count++
      return hit.count <= this.perMinute
    }
    this.counts.delete(address)
    this.counts.set(address, { count: 1, until: now + 60_000 })
    // Too many addresses: the oldest minutes go (a Map keeps insertion order)
    for (const key of this.counts.keys()) {
      if (this.counts.size <= this.max) {
        break
      }
      this.counts.delete(key)
    }
    return true
  }
}
