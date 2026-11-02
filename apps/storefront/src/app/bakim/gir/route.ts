import type { NextRequest } from "next/server"
import { seeOther } from "@/lib/checkout/return"
import { storefrontEnv } from "@/lib/env"
import { maintenanceResponse } from "@/lib/maintenance/page"
import { BYPASS_MAX_AGE, bypassCookieName, isBypassToken } from "@/lib/maintenance/rules"
import { checkBypass, edgeSite } from "@/lib/store-api/edge"
import { visitorIp } from "@/lib/store-api/visitor"

/**
 * `/bakim/gir?t=<token>` (adr/0053): a bypass link past the dark shop. A
 * well-formed token the backend accepts becomes an httpOnly cookie for a
 * week and the visitor goes home with a 303, so the token leaves the
 * address bar; the page leaks no Referer. A malformed or ended link gets
 * the maintenance page saying so (503, never indexed). While the shop is
 * open a link has nothing to bypass: home, without a cookie.
 */
async function enter(request: NextRequest): Promise<Response> {
  const env = storefrontEnv()
  const production = env.NODE_ENV === "production"
  const visitor = visitorIp(request.headers, env.STOREFRONT_TRUSTED_PROXY_HOPS ?? 0)
  const site = await edgeSite(visitor)
  const token = request.nextUrl.searchParams.get("t")
  const page = (linkInvalid: boolean) =>
    maintenanceResponse(
      { shopName: site.shopName, ...site.maintenance },
      {
        // Set by the proxy for this response, never by the visitor
        nonce: request.headers.get("x-nonce") ?? "",
        csp: request.headers.get("content-security-policy") ?? "",
        head: request.method === "HEAD",
        linkInvalid,
      }
    )
  if (!isBypassToken(token)) {
    return page(true)
  }
  if (!site.maintenance.enabled) {
    return withLinkHeaders(seeOther("/"))
  }
  const answer = await checkBypass(token, visitor)
  if (answer === "unknown") {
    // No word from the backend: the dark page as anyone sees it, the link kept for later
    return page(false)
  }
  if (answer === "closed") {
    return page(true)
  }
  const response = withLinkHeaders(seeOther("/"))
  response.cookies.set(bypassCookieName(production), token, {
    httpOnly: true,
    secure: production,
    sameSite: "lax",
    path: "/",
    maxAge: BYPASS_MAX_AGE,
  })
  return response
}

/** The link is a key: no Referer carries it on, nothing stores the answer. */
function withLinkHeaders<T extends Response>(response: T): T {
  response.headers.set("referrer-policy", "no-referrer")
  response.headers.set("cache-control", "no-store")
  response.headers.set("x-robots-tag", "noindex")
  return response
}

export const GET = enter
export const HEAD = enter
