/**
 * The Store API while the shop is in maintenance (adr/0053 Ek 2026-11-17).
 * The storefront's edge shows the dark page, but the publishable key is
 * public: without this, anyone calling the Store API directly could still
 * build a cart, start a payment and place an order. Pure: the middleware
 * (`api/http/maintenance-guard.ts`) and the tests share it.
 *
 * Every Store API write is closed but for the few named here, so a new
 * write route is closed until someone opens it on purpose. Reads stay open
 * (the catalogue for crawlers and the storefront's own maintenance page),
 * so do the provider callbacks (`/hooks/*`), the panel (`/admin/*`),
 * sign-in and the links in messages already sent.
 */

/** The key a write refused for maintenance answers with (503). */
export const MAINTENANCE_MESSAGE = "maintenance.shop_closed"

/**
 * A bypass link's token (`mnb_…`, adr/0053 §A.4) sent by the storefront for
 * a visitor holding its cookie. Checked by its signature against the
 * section's version, as `GET /store/maintenance/bypass/:token` does: a
 * value nobody signed opens nothing.
 */
export const MAINTENANCE_BYPASS_HEADER = "x-maintenance-bypass"

const READS: ReadonlySet<string> = new Set(["GET", "HEAD", "OPTIONS"])

/**
 * Store API writes that stay open while dark, by why:
 * - a read by POST: the payment result page's order access (a card paid
 *   just before maintenance still finds its order), a guest's order
 *   lookup, a gift card's balance, a shipping option's price;
 * - an order already placed: its cancellation and return request (the
 *   shopper's right of withdrawal does not wait for the shop);
 * - consent and privacy: withdrawing consent (account, cookies, a message's
 *   unsubscribe), confirming one asked for from a message already sent,
 *   a stock alert's confirmation link, a KVKK request (its deadline runs);
 * - the storefront's own 404 log.
 * Paths as `routePath` gives them: lower case, no trailing slash.
 */
const OPEN_WRITES: readonly RegExp[] = [
  /^\/store\/carts\/[^/]+\/order-access$/,
  /^\/store\/order-lookup$/,
  /^\/store\/gift-cards\/balance$/,
  /^\/store\/shipping-options\/[^/]+\/calculate$/,
  /^\/store\/orders\/[^/]+\/cancel$/,
  /^\/store\/orders\/[^/]+\/returns$/,
  /^\/store\/customers\/me\/consents$/,
  /^\/store\/customers\/me\/privacy-requests$/,
  /^\/store\/consents\/(?:cookies|unsubscribe|confirm)$/,
  /^\/store\/stock-alerts\/confirm$/,
  /^\/store\/seo\/not-found$/,
]

/** A new shopper account: Medusa's registration of a customer identity (any provider). */
const REGISTRATION = /^\/auth\/customer\/[^/]+\/register$/

export type MaintenanceDecision = { closed: false } | { closed: true; reason: string }

const OPEN: MaintenanceDecision = { closed: false }

/**
 * Whether a request is closed while the shop is in maintenance, whatever
 * the setting says: the middleware reads the setting only for one that is.
 * `path` is the route path (lower case, no trailing slash, no query).
 */
export function decideMaintenanceRequest(method: string, path: string): MaintenanceDecision {
  if (READS.has(method.toUpperCase())) {
    return OPEN
  }
  if (REGISTRATION.test(path)) {
    return { closed: true, reason: "maintenance_registration" }
  }
  if (path !== "/store" && !path.startsWith("/store/")) {
    return OPEN
  }
  if (OPEN_WRITES.some((open) => open.test(path))) {
    return OPEN
  }
  return { closed: true, reason: "maintenance_store_write" }
}

/** `Retry-After` when the shop gave no time, or one already past: an hour (as the storefront). */
export const RETRY_AFTER_DEFAULT = 3600
const RETRY_AFTER_MIN = 300
const RETRY_AFTER_MAX = 86_400

/**
 * Seconds until the shop expects to open, between five minutes and a day;
 * an hour when no time is given or it is past. The storefront's page says
 * the same (`apps/storefront/src/lib/maintenance/rules.ts`).
 */
export function maintenanceRetryAfter(expectedAt: string | null, now = Date.now()): number {
  const at = expectedAt ? Date.parse(expectedAt) : Number.NaN
  if (!Number.isFinite(at) || at <= now) {
    return RETRY_AFTER_DEFAULT
  }
  return Math.min(RETRY_AFTER_MAX, Math.max(RETRY_AFTER_MIN, Math.ceil((at - now) / 1000)))
}
