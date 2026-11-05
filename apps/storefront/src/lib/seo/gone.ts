import { NextResponse } from "next/server"

/**
 * A path the shop removed for good (`gone` from resolve: a deleted record's
 * reserved path, a 410 rule; docs/13 §2.4) answers 410 with the theme's
 * page in the shop's frame (adr/0046 Ek 2026-11-05). The proxy rewrites
 * the request to the storefront's own page for it, keeping the address in
 * the browser and the status on the answer.
 */

/** The storefront's page for a removed address: an underscore is in no slug (docs/13 §2.1). */
export const GONE_PAGE_PATH = "/_kaldirildi"

/** Set by the proxy alone on that rewrite; a visitor's own is dropped, so the page is never a 200. */
export const GONE_HEADER = "x-qt-gone"

/**
 * The 410: the request, with the headers the page reads (its nonce and
 * CSP, its address) and the proxy's mark, rewritten to the removed page;
 * the answer carries the page's CSP as every page does.
 */
export function goneResponse(requestUrl: string, headers: Headers, csp: string): NextResponse {
  const forwarded = new Headers(headers)
  forwarded.set(GONE_HEADER, "1")
  const response = NextResponse.rewrite(new URL(GONE_PAGE_PATH, requestUrl), {
    status: 410,
    request: { headers: forwarded },
  })
  response.headers.set("content-security-policy", csp)
  return response
}
