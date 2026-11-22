import type { MedusaRequest } from "@medusajs/framework/http"
import { parseEnv } from "../../lib/env"
import { verifiedClientIp } from "../../lib/security/client-ip"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import type { RateLimitProfile } from "../../lib/security/rate-limit/profiles"

let storefrontSecret: string | undefined | null = null

/**
 * The shopper's address for limits, fraud checks and evidence (adr/0046 §5):
 * the one the storefront's server signed, else the connection's own
 * (Express's `req.ip`, behind the trusted proxy; docs/04).
 */
export function clientIp(req: MedusaRequest): string | null {
  if (storefrontSecret === null) {
    storefrontSecret = parseEnv().STOREFRONT_IP_SECRET
  }
  return (
    verifiedClientIp(req.headers, storefrontSecret) ?? req.ip ?? req.socket.remoteAddress ?? null
  )
}

// How long a connection address that sent a signed call is known as our
// storefront's server, and how many such addresses are kept (a few servers)
export const STOREFRONT_SEEN_MS = 15 * 60 * 1000
export const STOREFRONT_ADDRESSES_KEPT = 16

// Connection address → when it last sent a signed call (this process)
const storefrontSeen = new Map<string, number>()

const connectionIp = (req: MedusaRequest): string | null =>
  req.ip ?? req.socket.remoteAddress ?? null

/** Tests change the environment between runs. */
export function resetClientIpSecret(): void {
  storefrontSecret = null
  storefrontSeen.clear()
}

function noteStorefront(address: string, now: number): void {
  storefrontSeen.delete(address)
  storefrontSeen.set(address, now)
  // The oldest first in a Map: drop it past the few servers kept
  const oldest = storefrontSeen.keys().next().value
  if (storefrontSeen.size > STOREFRONT_ADDRESSES_KEPT && oldest !== undefined) {
    storefrontSeen.delete(oldest)
  }
}

/**
 * Whether the request came through our storefront's server, the shopper's
 * address signed. The connection address of a signed call is remembered
 * for a while (`isStorefrontUnsigned`); only a holder of the secret can
 * make an address count as the storefront's.
 */
export function isStorefrontSigned(req: MedusaRequest, now: number = Date.now()): boolean {
  if (storefrontSecret === null) {
    storefrontSecret = parseEnv().STOREFRONT_IP_SECRET
  }
  const signed = verifiedClientIp(req.headers, storefrontSecret) !== null
  const address = signed ? connectionIp(req) : null
  if (address !== null) {
    noteStorefront(address, now)
  }
  return signed
}

/**
 * Whether an unsigned call came from our storefront's server: its
 * connection address sent a signed call lately. The storefront leaves the
 * shopper's address out when it cannot read it, so `clientIp` is then the
 * storefront's own: an address every shopper shares, never one to count a
 * shopper by. A server not seen signing yet (just started) is not known.
 */
export function isStorefrontUnsigned(req: MedusaRequest, now: number = Date.now()): boolean {
  if (isStorefrontSigned(req, now)) {
    return false
  }
  const address = connectionIp(req)
  const seen = address === null ? undefined : storefrontSeen.get(address)
  return seen !== undefined && now - seen <= STOREFRONT_SEEN_MS
}

/**
 * The `/store/*` profile for a request: the storefront's signed calls count
 * in their own, wider bucket (a page asks several), any other client in
 * the default one.
 */
export const storeProfileOf = (req: MedusaRequest): RateLimitProfile =>
  isStorefrontSigned(req)
    ? RATE_LIMIT_PROFILES.storefront_default
    : RATE_LIMIT_PROFILES.store_default
