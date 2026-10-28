/**
 * Rate limit profiles (docs/04: login, registration, password reset,
 * checkout, installment queries, coupons, SMS, webhooks). Each profile has
 * up to two limits: per client IP (an IPv6 client by its /64), and per IP
 * and identity (an e-mail, a cart, a phone number). One address cannot spray
 * many accounts, nor guess one account quickly. Guessing from many addresses
 * at once (a botnet) needs a limit per identity across addresses, which comes
 * with account lockout and its notice (docs/04 "artan gecikme + kilit").
 */

export interface Limit {
  max: number
  windowMs: number
}

export interface RateLimitProfile {
  name: string
  perIp?: Limit
  perIdentity?: Limit
  /**
   * Per identity from every address together. Only for identities a client
   * holds rather than names (a cart's id): counted so, an e-mail would let
   * anyone lock its owner out; a cart's tries are not spread over addresses.
   */
  perIdentityAnyIp?: Limit
}

const MINUTE = 60_000
const HOUR = 60 * MINUTE

export const RATE_LIMIT_PROFILES = {
  login: {
    name: "login",
    perIp: { max: 50, windowMs: 15 * MINUTE },
    perIdentity: { max: 10, windowMs: 15 * MINUTE },
  },
  register: { name: "register", perIp: { max: 10, windowMs: HOUR } },
  password_reset: {
    name: "password_reset",
    perIp: { max: 20, windowMs: HOUR },
    perIdentity: { max: 5, windowMs: HOUR },
  },
  token_refresh: { name: "token_refresh", perIp: { max: 60, windowMs: 15 * MINUTE } },
  auth_default: { name: "auth_default", perIp: { max: 120, windowMs: 15 * MINUTE } },
  store_default: { name: "store_default", perIp: { max: 600, windowMs: MINUTE } },
  admin_default: { name: "admin_default", perIp: { max: 1200, windowMs: MINUTE } },
  // Wired by their phases (F4 coupons, F5/F6 checkout and installments,
  // F9 SMS, webhooks per provider)
  checkout: {
    name: "checkout",
    perIp: { max: 60, windowMs: MINUTE },
    perIdentity: { max: 20, windowMs: MINUTE },
    // The cart's own budget, however many addresses start or complete it
    perIdentityAnyIp: { max: 30, windowMs: 10 * MINUTE },
  },
  coupon: {
    name: "coupon",
    perIp: { max: 30, windowMs: 10 * MINUTE },
    perIdentity: { max: 10, windowMs: 10 * MINUTE },
    // The cart's own budget, however many addresses try codes on it
    perIdentityAnyIp: { max: 10, windowMs: 10 * MINUTE },
  },
  installment: { name: "installment", perIp: { max: 30, windowMs: MINUTE } },
  // F7.13: a shopper cancelling an order; each may ask a provider for a refund
  order_cancel: {
    name: "order_cancel",
    perIp: { max: 20, windowMs: 10 * MINUTE },
    perIdentity: { max: 5, windowMs: 10 * MINUTE },
  },
  // F7.7: shipping picked orders at once, each asking a carrier for a label
  bulk_ship: {
    name: "bulk_ship",
    perIp: { max: 10, windowMs: MINUTE },
    perIdentityAnyIp: { max: 30, windowMs: 10 * MINUTE },
  },
  // F6: a checkout page's ways to pay; each may run the providers' health check
  payment_methods: { name: "payment_methods", perIp: { max: 60, windowMs: MINUTE } },
  sms: {
    name: "sms",
    perIp: { max: 10, windowMs: HOUR },
    perIdentity: { max: 3, windowMs: 10 * MINUTE },
  },
  webhook: { name: "webhook", perIp: { max: 600, windowMs: MINUTE } },
  // F5 V9: a shopper's browser back from a hosted form (iyzico), once per payment
  payment_return: {
    name: "payment_return",
    perIp: { max: 20, windowMs: MINUTE },
    perIdentityAnyIp: { max: 10, windowMs: 10 * MINUTE },
  },
  // F3.5: the storefront's 404 reports; beyond this a flood is not worth counting
  seo_report: { name: "seo_report", perIp: { max: 30, windowMs: MINUTE } },
  // F5 (adr/0027): saving or testing a provider account calls the provider
  // and per staff member from any address: not an oracle for other people's details
  provider_check: {
    name: "provider_check",
    perIp: { max: 20, windowMs: MINUTE },
    perIdentityAnyIp: { max: 60, windowMs: HOUR },
  },
} as const satisfies Record<string, RateLimitProfile>

export type RateLimitProfileName = keyof typeof RATE_LIMIT_PROFILES

/**
 * Integration tests sign many accounts up from one address; with
 * RATE_LIMIT_RELAXED=1 and NODE_ENV=test the per-IP limits grow a hundred
 * times. Per-identity limits never change, so the login limit stays testable.
 * Any other environment ignores the variable.
 */
export function perIpScale(env: NodeJS.ProcessEnv = process.env): number {
  return env["NODE_ENV"] === "test" && env["RATE_LIMIT_RELAXED"] === "1" ? 100 : 1
}
