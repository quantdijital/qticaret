import { NextResponse } from "next/server"

/**
 * A path the shop removed for good (`gone` from resolve: a deleted record's
 * reserved path, a 410 rule; docs/13 §2.4) answers 410 with the theme's
 * page in the shop's frame (adr/0046 Ek 2026-11-05). A path resolve knows
 * nothing at (`not_found`) answers 404 the same way. The proxy rewrites the
 * request to the storefront's own page for it, keeping the address in the
 * browser and the status on the answer.
 *
 * Why the 404 is a rewrite too, not `notFound()` in the page: Next 16
 * renders a page that throws `notFound()` while it is being made as an
 * empty error shell (`<html id="__next_error__">`); the theme's 404 is drawn
 * only by the browser's script, so a crawler or a reader without script
 * gets no heading, no search, no categories (docs/21 2026-11-06, 4). A
 * page rendered normally, its status set here, carries all of it in the
 * first HTML, as the 410 did.
 */

/** The storefront's page for a removed address: an underscore is in no slug (docs/13 §2.1). */
export const GONE_PAGE_PATH = "/_kaldirildi"

/** Set by the proxy alone on that rewrite; a visitor's own is dropped, so the page is never a 200. */
export const GONE_HEADER = "x-qt-gone"

/** The storefront's page for an address nothing lives at (no slug has an underscore either). */
export const NOT_FOUND_PAGE_PATH = "/_bulunamadi"

/** Set by the proxy alone on the 404 rewrite; a visitor's own is dropped. */
export const NOT_FOUND_HEADER = "x-qt-not-found"

/**
 * The request, with the headers the page reads (its nonce and CSP, its
 * address) and the proxy's mark, rewritten to the storefront's page with
 * `status`; the answer carries the page's CSP as every page does.
 */
function rewriteTo(
  page: string,
  mark: string,
  status: number,
  requestUrl: string,
  headers: Headers,
  csp: string
): NextResponse {
  const forwarded = new Headers(headers)
  forwarded.set(mark, "1")
  const response = NextResponse.rewrite(new URL(page, requestUrl), {
    status,
    request: { headers: forwarded },
  })
  response.headers.set("content-security-policy", csp)
  return response
}

/** The 410: the removed page. */
export const goneResponse = (requestUrl: string, headers: Headers, csp: string): NextResponse =>
  rewriteTo(GONE_PAGE_PATH, GONE_HEADER, 410, requestUrl, headers, csp)

/** The 404: the theme's not-found page with its ways on, whole in the first HTML. */
export const notFoundResponse = (requestUrl: string, headers: Headers, csp: string): NextResponse =>
  rewriteTo(NOT_FOUND_PAGE_PATH, NOT_FOUND_HEADER, 404, requestUrl, headers, csp)
