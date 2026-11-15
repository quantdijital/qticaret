import { NextRequest } from "next/server"
import type { EdgeSite } from "@/lib/store-api/edge"

/** What `gate.spec.ts` and `gate-suspended.spec.ts` share (no spec of its own). */
export const TOKEN = `mnb_AbCdEfGhIjKlMnOp.zzzzzzzz.${"A".repeat(43)}`

export const site = (enabled: boolean, suspended = false): EdgeSite => ({
  suspended,
  indexing: true,
  canonicalHost: null,
  indexNowKey: null,
  shopName: "Mağaza",
  tracking: { ga4: null, meta: null },
  maintenance: {
    enabled,
    title: null,
    message: null,
    expectedAt: null,
    allowPaths: ["/iletisim", "/sozlesmeler/*"],
  },
})

export const context = {
  nonce: "n",
  csp: "default-src 'self'",
  production: false,
  visitorIp: null,
}

export const request = (path: string, init: { method?: string; cookie?: string } = {}) =>
  new NextRequest(`http://localhost:8000${path}`, {
    method: init.method ?? "GET",
    headers: init.cookie ? { cookie: init.cookie } : {},
  })
