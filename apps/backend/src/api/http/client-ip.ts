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

/** Tests change the environment between runs. */
export function resetClientIpSecret(): void {
  storefrontSecret = null
}

/** Whether the request came through our storefront's server, the shopper's address signed. */
export function isStorefrontSigned(req: MedusaRequest): boolean {
  if (storefrontSecret === null) {
    storefrontSecret = parseEnv().STOREFRONT_IP_SECRET
  }
  return verifiedClientIp(req.headers, storefrontSecret) !== null
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
