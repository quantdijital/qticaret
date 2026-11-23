/**
 * The shops' own API (adr/0061 §3.2, §3.4, Ek C9): `/tenant-api/*`, a
 * route group apart from the staff's. Every route here is called by a shop
 * backend with a signed request (Ed25519, the shop's `tenant_key`) and by
 * nothing else: no staff session, no cookie, no bearer token is read, and
 * none of it lives under `/admin`, so Medusa's admin authentication never
 * applies and a staff credential opens nothing here. Reachable from the
 * internal network only once deployed (the proxy's rule, F16).
 *
 * Exactly these routes answer; any other `/tenant-api/*` path is a 404
 * before a signature is even read. A unit test holds the table and the
 * route files to each other.
 */

import { USAGE_REPORT_MAX_BYTES } from "@qticaret/types/control-plane"

export interface TenantApiRule {
  method: "GET" | "POST"
  /** Lower-cased as Express routes it. */
  path: string
  /** The largest body accepted, in bytes; 0 for none (a GET). */
  maxBodyBytes: number
}

export const TENANT_API_ROUTES: readonly TenantApiRule[] = [
  // The shop's latest plan document, its pull (the push's fallback)
  { method: "GET", path: "/tenant-api/v1/plan", maxBodyBytes: 0 },
  // Ek C13: the shop's hourly usage report (totals only, the contract's strict schema)
  { method: "POST", path: "/tenant-api/v1/usage", maxBodyBytes: USAGE_REPORT_MAX_BYTES },
  // Ek C20: the shop's own payment history, bound to the request's nonce
  { method: "GET", path: "/tenant-api/v1/billing", maxBodyBytes: 0 },
]

/** The table's row for a request (HEAD as GET), or null. */
export function matchTenantApi(method: string, path: string): TenantApiRule | null {
  const verb = method.toUpperCase() === "HEAD" ? "GET" : method.toUpperCase()
  return TENANT_API_ROUTES.find((rule) => rule.method === verb && rule.path === path) ?? null
}
