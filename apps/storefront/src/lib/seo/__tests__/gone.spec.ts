import { describe, expect, it } from "vitest"
import {
  GONE_HEADER,
  GONE_PAGE_PATH,
  NOT_FOUND_HEADER,
  NOT_FOUND_PAGE_PATH,
  goneResponse,
  notFoundResponse,
} from "../gone"

/**
 * A removed address (adr/0046 Ek 2026-11-05): the proxy answers 410 with
 * the theme's page, the request rewritten to the storefront's own page for
 * it, the browser's address unchanged.
 */
describe("goneResponse", () => {
  const headers = new Headers({
    "x-nonce": "n0nce",
    "content-security-policy": "default-src 'self'",
    "x-qt-url": "/eski-urun?renk=mavi",
  })
  const response = goneResponse("https://magaza.example.com/eski-urun?renk=mavi", headers, "csp")

  it("keeps the 410 and rewrites to the removed page, no redirect", () => {
    expect(response.status).toBe(410)
    expect(new URL(response.headers.get("x-middleware-rewrite") ?? "").pathname).toBe(
      GONE_PAGE_PATH
    )
    expect(response.headers.get("location")).toBeNull()
    expect(response.headers.get("content-security-policy")).toBe("csp")
  })

  it("marks the request as the proxy's, its nonce and address carried to the page", () => {
    const overridden = (response.headers.get("x-middleware-override-headers") ?? "").split(",")
    expect(overridden).toEqual(expect.arrayContaining([GONE_HEADER, "x-nonce", "x-qt-url"]))
    expect(response.headers.get(`x-middleware-request-${GONE_HEADER}`)).toBe("1")
    expect(response.headers.get("x-middleware-request-x-nonce")).toBe("n0nce")
    expect(response.headers.get("x-middleware-request-x-qt-url")).toBe("/eski-urun?renk=mavi")
    // The caller's headers are left as they were
    expect(headers.has(GONE_HEADER)).toBe(false)
  })

  it("lives at a path no record can take: slugs have no underscore (docs/13 §2.1)", () => {
    expect(GONE_PAGE_PATH).toMatch(/^\/_[a-z]+$/)
    expect(NOT_FOUND_PAGE_PATH).toMatch(/^\/_[a-z]+$/)
  })
})

/**
 * An address nothing lives at (docs/21 2026-11-06, 4): the 404 the same
 * way, so the theme's page is whole in the first HTML.
 */
describe("notFoundResponse", () => {
  const headers = new Headers({ "x-nonce": "n0nce", "x-qt-url": "/olmayan" })
  const response = notFoundResponse("https://magaza.example.com/olmayan", headers, "csp")

  it("keeps the 404 and rewrites to the not-found page with the proxy's mark", () => {
    expect(response.status).toBe(404)
    expect(new URL(response.headers.get("x-middleware-rewrite") ?? "").pathname).toBe(
      NOT_FOUND_PAGE_PATH
    )
    expect(response.headers.get(`x-middleware-request-${NOT_FOUND_HEADER}`)).toBe("1")
    expect(response.headers.get(`x-middleware-request-${GONE_HEADER}`)).toBeNull()
    expect(response.headers.get("content-security-policy")).toBe("csp")
    expect(headers.has(NOT_FOUND_HEADER)).toBe(false)
  })
})
