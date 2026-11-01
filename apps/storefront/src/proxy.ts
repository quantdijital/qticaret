import { NextResponse } from "next/server"
import type { NextRequest } from "next/server"
import { LANDING_COOKIE, landingOf } from "./lib/cart/landing"
import { paymentFrameOrigins, paymentRedirectOrigins, storefrontEnv } from "./lib/env"
import { t } from "./lib/i18n"
import { contentSecurityPolicy, newNonce } from "./lib/security/csp"
import {
  backendFile,
  canonicalHostRedirect,
  indexNowFile,
  isStorefrontIndex,
  isSystemPath,
  normalizedPath,
} from "./lib/seo/paths"
import {
  backendFileResponse,
  edgeSite,
  reportNotFound,
  resolveForProxy,
} from "./lib/store-api/edge"
import { visitorIp } from "./lib/store-api/visitor"

/** The address the page renders, query included; set here, never taken from the browser. */
export const URL_HEADER = "x-qt-url"

function gonePage(nonce: string, csp: string): NextResponse {
  const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="robots" content="noindex"><title>${t("gone.title")}</title></head><body><main><h1>${t("gone.title")}</h1><p>${t("gone.body")}</p><p><a href="/">${t("not_found.home")}</a></p></main></body></html>`
  return new NextResponse(html, {
    status: 410,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "content-security-policy": csp,
      "x-nonce": nonce,
    },
  })
}

/** Where a card provider sends the shopper back (D7): possibly inside its own frame on our page. */
const isPaymentReturn = (pathname: string) =>
  pathname === "/odeme/sonuc" || pathname.startsWith("/odeme/sonuc/")

/**
 * Before every page (adr/0046 §4): in production one 301 to the shop's
 * canonical host, the backend's files at the root (and the IndexNow key
 * file while the shop announces), one 301 to the normalised address, the backend's redirects and 410s with
 * their own codes, 404s reported, a nonce'd CSP, and `noindex` on an
 * instance search engines must not index (staging; docs/13 §6).
 */
export async function proxy(request: NextRequest): Promise<Response> {
  const env = storefrontEnv()
  // The address as sent: Next's `nextUrl` drops a trailing slash on its own,
  // which would hide the very form we answer with a 301
  const { pathname, search } = new URL(request.url)
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

  const normalized = normalizedPath(pathname)
  if (normalized !== null) {
    return NextResponse.redirect(new URL(`${normalized}${search}`, request.url), 301)
  }

  const nonce = newNonce()
  const csp = contentSecurityPolicy(nonce, env.NODE_ENV === "development", {
    frameOrigins: paymentFrameOrigins(env),
    framedBySelf: isPaymentReturn(pathname),
    // The card provider's own pages: iyzico's a form may lead to, and PayTR's
    // framed form, whose "pay" posts to its own origin for the whole window
    formOrigins: pathname.startsWith("/odeme")
      ? [...paymentRedirectOrigins(env), ...paymentFrameOrigins(env)]
      : [],
  })
  const isPageView = request.method === "GET" || request.method === "HEAD"
  if (isPageView && pathname !== "/" && !isSystemPath(pathname) && !isStorefrontIndex(pathname)) {
    const resolution = await resolveForProxy(`${pathname}${search}`, visitor)
    if (resolution?.type === "redirect") {
      return NextResponse.redirect(new URL(resolution.location, request.url), resolution.status)
    }
    if (resolution?.type === "gone") {
      return gonePage(nonce, csp)
    }
    // A prefetch is not a visit
    if (resolution?.type === "not_found" && !request.headers.has("next-router-prefetch")) {
      reportNotFound(`${pathname}${search}`, request.headers.get("referer"), visitor)
    }
  }

  const headers = new Headers(request.headers)
  headers.set("x-nonce", nonce)
  headers.set("content-security-policy", csp)
  headers.set(URL_HEADER, `${pathname}${search}`)
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
    if (landing) {
      response.cookies.set(landingName, encodeURIComponent(JSON.stringify(landing)), {
        httpOnly: true,
        secure: env.NODE_ENV === "production",
        sameSite: "lax",
        path: "/",
      })
    }
  }
  if (!site.indexing) {
    response.headers.set("x-robots-tag", "noindex, nofollow")
  }
  return response
}

export const config = {
  // Everything but Next's own build files and the favicon
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
}
