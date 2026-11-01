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
  // The storefront's server (adr/0046 §5) asks a few calls per page it makes,
  // for the shopper whose address it signed: counted per that address, in a
  // wider bucket than a client calling the API directly. Logins, checkout,
  // codes and the rest keep their own, unchanged profiles.
  storefront_default: { name: "storefront_default", perIp: { max: 3000, windowMs: MINUTE } },
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
  // F10.6 (adr/0037 §4): a customer writing reviews; per IP and per customer
  review_write: {
    name: "review_write",
    perIp: { max: 20, windowMs: HOUR },
    perIdentity: { max: 10, windowMs: HOUR },
  },
  // F10.5 (adr/0037 §4): a stock alert may mail a confirmation; per IP and per address
  stock_alert: {
    name: "stock_alert",
    perIp: { max: 10, windowMs: 15 * MINUTE },
    perIdentity: { max: 5, windowMs: HOUR },
  },
  // F10.13 (adr/0005): staff asking a provider for drafts; each costs the shop, beside its monthly quota
  content_draft: {
    name: "content_draft",
    perIp: { max: 30, windowMs: 10 * MINUTE },
    perIdentity: { max: 20, windowMs: 10 * MINUTE },
  },
  // F10.8 (adr/0038 §3): Google, Meta and the like fetching a feed; a guess finds nothing
  feed: { name: "feed", perIp: { max: 60, windowMs: 15 * MINUTE } },
  // F10.7 (adr/0038 §1): a cart reminder's link back to the cart; a guess finds nothing
  cart_return: { name: "cart_return", perIp: { max: 30, windowMs: 15 * MINUTE } },
  // F10.1 (adr/0037 §2): "find my order" mails the order's link; per IP and per address
  order_lookup: {
    name: "order_lookup",
    perIp: { max: 10, windowMs: 15 * MINUTE },
    perIdentity: { max: 3, windowMs: HOUR },
  },
  // F14.5: a moved customer's claim key, guessed at nowhere: a few tries an hour
  migration_claim: {
    name: "migration_claim",
    perIp: { max: 10, windowMs: 15 * MINUTE },
    perIdentity: { max: 5, windowMs: HOUR },
  },
  // F7.13: a shopper cancelling an order; each may ask a provider for a refund
  order_cancel: {
    name: "order_cancel",
    perIp: { max: 20, windowMs: 10 * MINUTE },
    perIdentity: { max: 5, windowMs: 10 * MINUTE },
  },
  // F7.9: a shopper asking to return lines of an order; a budget of its own
  return_request: {
    name: "return_request",
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
  // F11.6: a secret API key's calls, wherever it calls from (adr/0039 §6)
  api_key: {
    name: "api_key",
    perIp: { max: 1200, windowMs: MINUTE },
    perIdentityAnyIp: { max: 600, windowMs: MINUTE },
  },
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
 * How many times larger the per-IP limits are; per-identity limits never
 * change, so the login limit stays testable:
 * - a load test (F15.3) sends a crowd's requests from one machine: with
 *   LOAD_TEST=on, a thousand times, on an explicit development, test or
 *   staging environment only (the environment check refuses it elsewhere,
 *   and an unset NODE_ENV is treated as live);
 * - integration tests sign many accounts up from one address: with
 *   RATE_LIMIT_RELAXED=1 and NODE_ENV=test, a hundred times.
 */
export function perIpScale(env: NodeJS.ProcessEnv = process.env): number {
  const nodeEnv = env["NODE_ENV"]
  if (
    env["LOAD_TEST"] === "on" &&
    (nodeEnv === "development" || nodeEnv === "test" || nodeEnv === "staging")
  ) {
    return 1000
  }
  return nodeEnv === "test" && env["RATE_LIMIT_RELAXED"] === "1" ? 100 : 1
}
