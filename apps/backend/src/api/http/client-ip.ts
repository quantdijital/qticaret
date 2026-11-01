import type { MedusaRequest } from "@medusajs/framework/http"
import { parseEnv } from "../../lib/env"
import { verifiedClientIp } from "../../lib/security/client-ip"

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
