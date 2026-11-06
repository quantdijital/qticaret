import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { LANDING_COOKIE, landingCookieValue, landingOf } from "./lib/cart/landing"
import { panelOrigins, paymentFrameOrigins, paymentRedirectOrigins, storefrontEnv } from "./lib/env"
import { maintenanceGate } from "./lib/maintenance/gate"
import {
  GONE_HEADER,
  GONE_PAGE_PATH,
  NOT_FOUND_HEADER,
  NOT_FOUND_PAGE_PATH,
  goneResponse,
  notFoundResponse,
} from "./lib/seo/gone"
import { contentSecurityPolicy, newNonce } from "./lib/security/csp"
import {
  backendFile,
  canonicalHostRedirect,
  indexNowFile,
  isCataloguePage,
  isStaticFile,
  normalizedPath,
  resolvesAt,
} from "./lib/seo/paths"
import { rateLimitedFor } from "./lib/store-api/busy"
import { rateLimitedResponse } from "./lib/store-api/busy-page"
import {
  backendFileResponse,
  edgeSite,
  reportNotFound,
  resolveForProxy,
} from "./lib/store-api/edge"
import { visitorIp } from "./lib/store-api/visitor"
import { REFRESH_PATH } from "./lib/refresh/contract"

/** The address the page renders, query included; set here, never taken from the browser. */
export const URL_HEADER = "x-qt-url"

/** A design preview's token (adr/0049): set here only, so the frame shows the draft's header and footer. */
export const LAYOUT_PREVIEW_HEADER = "x-qt-layout-preview"

const LAYOUT_PREVIEW = /^\/onizleme\/(sfl_[0-9A-Za-z]{1,40}\.[0-9a-z]{1,12}\.[\w-]{43})$/

/** The storefront's own pages for a removed and a missing address: the proxy rewrites to them. */
const isFallbackPage = (pathname: string) =>
  pathname === GONE_PAGE_PATH || pathname === NOT_FOUND_PAGE_PATH

/** Where a card provider sends the shopper back (D7): possibly inside its own frame on our page. */
const isPaymentReturn = (pathname: string) =>
  pathname === "/odeme/sonuc" || pathname.startsWith("/odeme/sonuc/")

/**
 * Before every page (adr/0046 §4): in production one 301 to the shop's
 * canonical host, the backend's files at the root (and the IndexNow key
 * file while the shop announces), one 301 to the normalised address (or
 * straight to where resolve sends that address, or its 410, adr/0059), a
 * nonce'd CSP, the dark shop's 503 (adr/0053: but for its open paths and
 * a bypass cookie), the backend's redirects and 410s with
 * their own codes, 404s reported and answered with the theme's page, a
 * 503 while the backend's rate limit holds the visitor, and `noindex` on an
 * instance search engines must not index (staging; docs/13 §6) or a page
 * seen through a bypass link.
 */
export async function proxy(request: NextRequest): Promise<Response> {
  const env = storefrontEnv()
  // The address as sent: Next's `nextUrl` drops a trailing slash on its own,
  // which would hide the very form we answer with a 301
  const { pathname, search } = new URL(request.url)
  // The backend's refresh signal (adr/0048 Ek 2026-11-03) goes straight to its route: no host
  // 301, no normalising, no maintenance page (the backend follows no redirect), nothing resolved
  if (pathname === REFRESH_PATH) {
    return NextResponse.next()
  }
  // The matcher already leaves these out; should one reach here, it is a file, never a page
  if (isStaticFile(pathname)) {
    return NextResponse.next()
  }
  const visitor = visitorIp(request.headers, env.STOREFRONT_TRUSTED_PROXY_HOPS ?? 0)
  const site = await edgeSite(visitor)

  // Development runs on localhost whatever the shop's host is
  if (env.NODE_ENV === "production") {
    const target = canonicalHostRedirect(
      request.headers.get("host"),
      site.canonicalHost,
      `${pathname}${search}`
    )
    if (target) {
      return NextResponse.redirect(target, 301)
    }
  }

  const key = indexNowFile(pathname, site.indexNowKey)
  if (key) {
    return new Response(key, {
      headers: { "content-type": "text/plain; charset=utf-8", "x-content-type-options": "nosniff" },
    })
  }

  const file = backendFile(pathname)
  if (file) {
    return backendFileResponse(file, visitor)
  }

  const isPageView = request.method === "GET" || request.method === "HEAD"
  const normalized = normalizedPath(pathname)
  // An unclean old address the backend removed: its 410 below, once the page's frame is set
  let goneUnclean = false
  if (normalized !== null) {
    // One hop (docs/13 §4, adr/0059): an old address the backend sends on (`/eski-yol/`,
    // `/wp-content/uploads/X.JPG`) goes straight to its page, not through its clean form
    // first; one it removed (`/wp-login.php/`, `/Feed/`) answers its 410 at once
    const onward =
      isPageView && resolvesAt(normalized, search)
        ? await resolveForProxy(`${normalized}${search}`, visitor)
        : null
    if (onward?.type === "redirect") {
      return NextResponse.redirect(new URL(onward.location, request.url), onward.status)
    }
    if (onward?.type !== "gone") {
      return NextResponse.redirect(new URL(`${normalized}${search}`, request.url), 301)
    }
    goneUnclean = true
  }

  const nonce = newNonce()
  const csp = contentSecurityPolicy(nonce, env.NODE_ENV === "development", {
    frameOrigins: paymentFrameOrigins(env),
    framedBySelf: isPaymentReturn(pathname),
    // The theme editor frames its draft (adr/0049); no other page may be framed by the panel
    framedBy: pathname.startsWith("/onizleme/") ? panelOrigins(env) : [],
    // The card provider's own pages: iyzico's a form may lead to, and PayTR's
    // framed form, whose "pay" posts to its own origin for the whole window
    formOrigins: pathname.startsWith("/odeme")
      ? [...paymentRedirectOrigins(env), ...paymentFrameOrigins(env)]
      : [],
    // The shop's measurement tags (docs/20): their hosts only while connected
    tags: { google: site.tracking.ga4 !== null, meta: site.tracking.meta !== null },
  })
  // The dark shop (adr/0053): pages, Server Actions and route handlers alike
  const gate = await maintenanceGate(request, pathname, site, {
    nonce,
    csp,
    production: env.NODE_ENV === "production",
    visitorIp: visitor,
  })
  if (gate.blocked) {
    return gate.blocked
  }

  const headers = new Headers(request.headers)
  // Never the visitor's own: only a preview address sets the one, a removed or missing page the others
  headers.delete(LAYOUT_PREVIEW_HEADER)
  headers.delete(GONE_HEADER)
  headers.delete(NOT_FOUND_HEADER)
  const preview = LAYOUT_PREVIEW.exec(pathname)?.[1]
  if (preview) {
    headers.set(LAYOUT_PREVIEW_HEADER, preview)
  }
  headers.set("x-nonce", nonce)
  headers.set("content-security-policy", csp)
  headers.set(URL_HEADER, `${pathname}${search}`)

  if (goneUnclean) {
    return goneResponse(request.url, headers, csp)
  }
  // The backend's rate limit holds this visitor back (a fast crawler): 503, not the 500 a
  // page would fail with (`busy.ts`); asked again after a resolve that just met it
  const limited = () => (isPageView && isCataloguePage(pathname) ? rateLimitedFor(visitor) : null)
  const waitBefore = limited()
  if (waitBefore !== null) {
    return rateLimitedResponse(waitBefore, request.method === "HEAD")
  }
  // The home page and the storefront's own lists only for an old platform's query (adr/0059)
  if (isPageView && !isFallbackPage(pathname) && resolvesAt(pathname, search)) {
    const resolution = await resolveForProxy(`${pathname}${search}`, visitor)
    if (resolution?.type === "redirect") {
      return NextResponse.redirect(new URL(resolution.location, request.url), resolution.status)
    }
    if (resolution?.type === "gone") {
      // The theme's removed page in the shop's frame, the 410 kept (adr/0046 Ek 2026-11-05)
      return goneResponse(request.url, headers, csp)
    }
    const waitAfter = resolution === null ? limited() : null
    if (waitAfter !== null) {
      return rateLimitedResponse(waitAfter, request.method === "HEAD")
    }
    // An address nothing lives at: the theme's 404, whole in the first HTML (`lib/seo/gone.ts`).
    // The home page and a list render whatever their query; a prefetch is not a visit
    if (resolution?.type === "not_found" && resolvesAt(pathname, "")) {
      if (!request.headers.has("next-router-prefetch")) {
        reportNotFound(`${pathname}${search}`, request.headers.get("referer"), visitor)
      }
      return notFoundResponse(request.url, headers, csp)
    }
  }

  const response = NextResponse.next({ request: { headers } })
  response.headers.set("content-security-policy", csp)
  // The visit's first landing (F11.2): kept for its first cart, nothing of the person
  const landingName = env.NODE_ENV === "production" ? `__Host-${LANDING_COOKIE}` : LANDING_COOKIE
  if (
    isPageView &&
    !request.cookies.has(landingName) &&
    !request.headers.has("next-router-prefetch")
  ) {
    const landing = landingOf(new URL(request.url), request.headers.get("referer"))
    const value = landing ? landingCookieValue(landing) : null
    if (value) {
      response.cookies.set(landingName, value, {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      })
    }
  }
  if (!site.indexing) {
    response.headers.set("x-robots-tag", "noindex, nofollow")
  } else if (gate.bypassed) {
    // The dark shop seen through a bypass link: nobody's search result, never stored
    response.headers.set("x-robots-tag", "noindex")
  }
  if (gate.bypassed) {
    response.headers.set("cache-control", "private, no-store")
  }
  return response
}

export const config = {
  // Everything but Next's own build files, the app's metadata files and the
  // self-hosted faces and the providers' marks (`isStaticFile`): a file is no
  // page to resolve or report
  // Exact exclusions: a page whose path only starts like one still passes
  // through here (its CSP, and the preview header set only here)
  matcher: [
    "/((?!_next/static/|_next/image(?:$|/)|favicon\\.ico$|icon\\.svg$|apple-icon\\.png$|manifest\\.webmanifest$|fonts/[a-z-]+\\.[0-9a-f]{10}\\.woff2$|marks/[a-z_]+\\.(?:svg|png)$).*)",
  ],
}
