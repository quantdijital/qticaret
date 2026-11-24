import { isIP } from "node:net"
import type { MedusaRequest } from "@medusajs/framework/http"
import { parseEnv } from "../../lib/env"
import { logger } from "../../lib/logging"
import { CLIENT_IP_HEADERS, verifiedClientAddress } from "../../lib/security/client-ip"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import type { RateLimitProfile } from "../../lib/security/rate-limit/profiles"

let storefrontSecret: string | undefined | null = null

function secret(): string | undefined {
  if (storefrontSecret === null) {
    storefrontSecret = parseEnv().STOREFRONT_IP_SECRET
  }
  return storefrontSecret
}

const MISMATCH_WARN_EVERY_MS = 10 * 60_000
let lastMismatchWarn = 0

/**
 * What the storefront's server signed on this request, if anything valid
 * (see `lib/security/client-ip`). A signature sent but refused (no or a
 * different secret here, clocks apart) warns now and then: every shopper
 * would quietly count as the storefront's one address (security review D-1).
 */
function vouched(req: MedusaRequest): { ip: string | null } | null {
  const result = verifiedClientAddress(req.headers, secret())
  if (result === null && req.headers[CLIENT_IP_HEADERS.signature] !== undefined) {
    const now = Date.now()
    if (now - lastMismatchWarn >= MISMATCH_WARN_EVERY_MS) {
      lastMismatchWarn = now
      logger.warn({ event: "security.storefront_signature_refused" })
    }
  }
  return result
}

/**
 * The shopper's address for limits, fraud checks and evidence (adr/0046 §5):
 * the one the storefront's server signed, else Cloudflare's when trusted
 * (`cloudflareIp`), else the connection's own
 * (Express's `req.ip`, behind the trusted proxy; docs/04). A call the
 * storefront signed as "address unknown" falls back to the connection's
 * too (the storefront's own address), as an unsigned one always did; a
 * count that must not lump shoppers together asks `isShopperAddressUnknown`.
 */
export function clientIp(req: MedusaRequest): string | null {
  return vouched(req)?.ip ?? cloudflareIp(req) ?? req.ip ?? req.socket.remoteAddress ?? null
}

let trustCloudflare: boolean | null = null

/**
 * Behind Cloudflare (adr/0044 Ek 2026-11-24) the connection's address is
 * Cloudflare's edge; the visitor's is its `CF-Connecting-IP`. Believed only
 * with `TRUST_CF_CONNECTING_IP=on`, set where the origin answers Cloudflare
 * alone (F16): otherwise anyone could write the header. One valid address,
 * else none.
 */
function cloudflareIp(req: MedusaRequest): string | null {
  trustCloudflare ??= parseEnv().TRUST_CF_CONNECTING_IP === "on"
  if (!trustCloudflare) {
    return null
  }
  const value = req.headers["cf-connecting-ip"]
  return typeof value === "string" && isIP(value.trim()) !== 0 ? value.trim() : null
}

/** Tests change the environment between runs. */
export function resetClientIpSecret(): void {
  storefrontSecret = null
  trustCloudflare = null
}

/** Whether the request came through our storefront's server, signed (an address or "unknown"). */
export function isStorefrontSigned(req: MedusaRequest): boolean {
  return vouched(req) !== null
}

/**
 * Whether our storefront's server signed that it could not read the
 * shopper's address (adr/0076 Ek D5): the connection's address is then the
 * storefront's own, which every such shopper shares, never one to count a
 * shopper by. Only a holder of the secret can say so; a plain unsigned
 * call is a direct client, counted by its own address.
 */
export function isShopperAddressUnknown(req: MedusaRequest): boolean {
  const signed = vouched(req)
  return signed !== null && signed.ip === null
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
