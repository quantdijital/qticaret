import type { RateLimitStore } from "../security/rate-limit"

/**
 * Checkout velocity (F15.6, adr/0044 §2): carts a visitor's address
 * completes, orders an e-mail places, the e-mails one address and one
 * phone use. Counted in the shared store under keyed hashes and address
 * buckets only. Past a soft limit the visitor proves themselves (a
 * challenge), past a hard one the checkout stops.
 */

export interface Bound {
  challenge: number
  block: number
}

export interface VelocityLimits {
  ipHour: Bound
  emailHour: Bound
  ipEmailsDay: Bound
}

// An address may be a mobile carrier's, shared by thousands (CGNAT): past
// its soft limits a person proves themselves, its hard ones are far. An
// e-mail is anyone's to type into a cart: it asks a proof, never stops one
export const CHECKOUT_VELOCITY: VelocityLimits = {
  ipHour: { challenge: 5, block: 30 },
  emailHour: { challenge: 3, block: Number.POSITIVE_INFINITY },
  ipEmailsDay: { challenge: 3, block: 30 },
}

export type Verdict = "ok" | "challenge" | "block"

export interface CheckoutCounts {
  verdict: Verdict
  /** Distinct e-mails this address used today, this one counted. */
  ipEmails: number
  /** Distinct e-mails this phone used this week, this one counted. */
  phoneEmails: number
}

const HOUR = 60 * 60 * 1000
const DAY = 24 * HOUR
const WEEK = 7 * DAY

const verdictOf = (count: number, bound: Bound): Verdict =>
  count > bound.block ? "block" : count > bound.challenge ? "challenge" : "ok"

const ORDER: Verdict[] = ["ok", "challenge", "block"]
const strictest = (verdicts: Verdict[]): Verdict =>
  verdicts.reduce((worst, one) => (ORDER.indexOf(one) > ORDER.indexOf(worst) ? one : worst), "ok")

/** How many distinct values a key has met in the window: a value counts the first time only. */
async function distinct(
  store: RateLimitStore,
  key: string,
  value: string,
  windowMs: number
): Promise<number> {
  const seen = await store.hit(`${key}:${value}`, windowMs)
  return seen.count === 1 ? (await store.hit(key, windowMs)).count : store.peek(key)
}

const scaled = (bound: Bound, scale: number): Bound => ({
  challenge: bound.challenge * scale,
  block: bound.block * scale,
})

/**
 * Counts one checkout attempt and says what it may do. `scale` grows every
 * limit as the rate limits grow in integration tests, where one address
 * and one test e-mail place every order.
 */
export async function countCheckout(
  store: RateLimitStore,
  input: { ipBucket: string; emailKey: string | null; phoneKey: string | null },
  limits: VelocityLimits = CHECKOUT_VELOCITY,
  scale = 1
): Promise<CheckoutCounts> {
  const ip = await store.hit(`fraud:ip:h:${input.ipBucket}`, HOUR)
  const email = input.emailKey ? await store.hit(`fraud:email:h:${input.emailKey}`, HOUR) : null
  const ipEmails = input.emailKey
    ? await distinct(store, `fraud:ipmails:${input.ipBucket}`, input.emailKey, DAY)
    : 0
  const phoneEmails =
    input.emailKey && input.phoneKey
      ? await distinct(store, `fraud:phonemails:${input.phoneKey}`, input.emailKey, WEEK)
      : 0
  return {
    verdict: strictest([
      verdictOf(ip.count, scaled(limits.ipHour, scale)),
      email ? verdictOf(email.count, scaled(limits.emailHour, scale)) : "ok",
      verdictOf(ipEmails, scaled(limits.ipEmailsDay, scale)),
    ]),
    ipEmails,
    phoneEmails,
  }
}

/** What a checkout not counted leaves: nothing seen. */
export const UNCOUNTED: CheckoutCounts = { verdict: "ok", ipEmails: 0, phoneEmails: 0 }

// This machine itself: IPv4's loopback block, IPv6's, and IPv4's as IPv6 writes it
const isLoopback = (ip: string): boolean =>
  ip === "::1" || /^(?:::ffff:)?127(?:\.\d{1,3}){3}$/i.test(ip)

/**
 * Whether a checkout start goes uncounted: one from this machine itself on
 * a developer's machine (NODE_ENV=development), where the storefront's e2e
 * runs and the owner's own tries all start from loopback with a new e-mail
 * each and would meet the hard limits within a day. Tests and every
 * deployed instance count every address, loopback included.
 */
export function isVelocityExempt(
  ip: string | null | undefined,
  env: { NODE_ENV?: string | undefined }
): boolean {
  return env.NODE_ENV === "development" && typeof ip === "string" && isLoopback(ip.trim())
}

/** Where checkout leaves what it counted on the cart, for the order's score: numbers only. */
export const CART_SIGNALS = "qt_fraud_signals"

export interface CartSignals {
  ip_emails: number
  phone_emails: number
}
