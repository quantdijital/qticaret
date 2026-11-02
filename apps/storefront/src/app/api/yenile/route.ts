import { storefrontEnv } from "@/lib/env"
import { handleRefresh } from "@/lib/refresh/handler"
import { forgetScopes } from "@/lib/refresh/scopes"
import { AddressBudget, NonceLedger } from "@/lib/refresh/verify"
import { visitorIp } from "@/lib/store-api/visitor"

// The signature is checked with node:crypto; never a cached answer
export const runtime = "nodejs"
export const dynamic = "force-dynamic"

// This process's nonces and per-address budget (30 a minute, before any signature is checked)
const nonces = new NonceLedger()
const budget = new AddressBudget(30)

/**
 * `POST /api/yenile` (adr/0048 Ek 2026-11-03): the backend's signed
 * "refresh" signal. 204 once the caches the scopes touched are dropped;
 * 401 without a body for anything wrong; 404 while the storefront has no
 * shared secret. Other methods: Next's own 405. The proxy lets this path
 * through untouched.
 */
export async function POST(request: Request): Promise<Response> {
  const env = storefrontEnv()
  return handleRefresh(request, {
    secret: env.STOREFRONT_IP_SECRET,
    nowMs: Date.now(),
    address: visitorIp(request.headers, env.STOREFRONT_TRUSTED_PROXY_HOPS ?? 0),
    nonces,
    budget,
    forget: forgetScopes,
  })
}
