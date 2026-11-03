import type { MedusaRequest } from "@medusajs/framework/http"
import { logger } from "../../../lib/logging"
import { csrfProtection } from "../csrf"
import { adminLimitGuard, storeLimitGuard, uploadSizeGate } from "../request-limits"
import { rejectAmbiguousPath, routePath } from "../request-path"
import { applySecurityHeaders } from "../security-headers"
import { fakeResponse } from "./fakes"

const firstOrigin = (list: string | undefined) =>
  new URL((list ?? "").split(",")[0]?.trim() ?? "").origin

const request = (fields: {
  path?: string
  method?: string
  headers?: Record<string, string>
  query?: Record<string, unknown>
}) =>
  ({
    path: fields.path ?? "/store/customers/me",
    // Mounted middlewares see a stripped req.path; the full one is in originalUrl
    originalUrl: fields.path ?? "/store/customers/me",
    method: fields.method ?? "POST",
    headers: fields.headers ?? {},
    query: fields.query ?? {},
    requestId: "req-12345678",
  }) as unknown as MedusaRequest

function run(middleware: typeof csrfProtection, req: MedusaRequest) {
  const response = fakeResponse()
  const next = jest.fn()
  middleware(req, response.res, next)
  return { ...response, next }
}

const COOKIE = "connect.sid=s%3Aabc"

beforeEach(() => {
  jest.spyOn(logger, "info").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("applySecurityHeaders", () => {
  it("sets the API headers and drops X-Powered-By", () => {
    const response = fakeResponse()

    applySecurityHeaders(response.res)

    expect(response.headers).toMatchObject({
      "x-content-type-options": "nosniff",
      "x-frame-options": "DENY",
      "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
      "referrer-policy": "no-referrer",
      "x-powered-by": "<removed>",
    })
    // NODE_ENV=test counts as local: no HSTS
    expect(response.headers).not.toHaveProperty("strict-transport-security")
  })
})

describe("csrfProtection", () => {
  const storeOrigin = firstOrigin(process.env["STORE_CORS"])
  const adminOrigin = firstOrigin(process.env["ADMIN_CORS"])

  it.each([
    ["a request without the session cookie", { headers: { origin: "https://evil.example" } }],
    ["a read", { method: "GET", headers: { cookie: COOKIE, origin: "https://evil.example" } }],
    [
      "a cookie mutation outside the API areas from any allowed origin",
      { path: "/hooks/x", headers: { cookie: COOKIE, origin: adminOrigin } },
    ],
  ])("lets %s through", (_label, fields) => {
    expect(run(csrfProtection, request(fields)).next).toHaveBeenCalled()
  })

  it("accepts a cookie mutation from an allowed origin, or a referer from one", () => {
    expect(
      run(csrfProtection, request({ headers: { cookie: COOKIE, origin: storeOrigin } })).next
    ).toHaveBeenCalled()
    expect(
      run(
        csrfProtection,
        request({ headers: { cookie: COOKIE, referer: `${storeOrigin}/hesabim` } })
      ).next
    ).toHaveBeenCalled()
  })

  it.each([
    ["another origin", { cookie: COOKIE, origin: "https://evil.example" }],
    ["no origin and no referer", { cookie: COOKIE }],
    ["an opaque origin", { cookie: COOKIE, origin: "null" }],
    [
      "an opaque origin with an allowed referer (a redirect, a sandboxed frame)",
      { cookie: COOKIE, origin: "null", referer: `${storeOrigin}/hesabim` },
    ],
  ])("refuses a cookie mutation from %s with 403", (_label, headers) => {
    const result = run(csrfProtection, request({ headers }))

    expect(result.next).not.toHaveBeenCalled()
    expect(result.status()).toBe(403)
    expect(result.body()).toMatchObject({ message: "errors.csrf_rejected" })
  })

  it.each([
    ["an upper-case admin path", "/ADMIN/invites"],
    ["an admin path with a trailing slash", "/admin/invites/"],
    ["an absolute-form admin target", "http://api.shop.example/admin/invites"],
    ["a path outside the API areas", "/hooks/x"],
  ])("refuses %s from another origin", (_label, path) => {
    const result = run(
      csrfProtection,
      request({ path, headers: { cookie: COOKIE, origin: "https://evil.example" } })
    )

    expect(result.status()).toBe(403)
    expect(result.body()).toMatchObject({ message: "errors.csrf_rejected" })
  })

  it("holds an upper-case admin path to the admin body rules", () => {
    const req = request({
      path: "/ADMIN/invites",
      headers: {
        cookie: COOKIE,
        origin: adminOrigin,
        "content-type": "application/x-www-form-urlencoded",
        "content-length": "10",
      },
    })

    expect(run(csrfProtection, req).status()).toBe(403)
  })

  it("requires JSON bodies on admin mutations, multipart uploads aside", () => {
    const admin = (path: string, type: string) =>
      request({
        path,
        headers: {
          cookie: COOKIE,
          origin: adminOrigin,
          "content-type": type,
          "content-length": "10",
        },
      })

    expect(
      run(csrfProtection, admin("/admin/products", "application/json")).next
    ).toHaveBeenCalled()
    expect(
      run(csrfProtection, admin("/admin/uploads", "multipart/form-data; boundary=x")).next
    ).toHaveBeenCalled()
    expect(
      run(csrfProtection, admin("/admin/products", "application/x-www-form-urlencoded")).status()
    ).toBe(403)
    expect(run(csrfProtection, admin("/admin/products", "text/plain")).status()).toBe(403)
    // Multipart only where files are taken
    expect(
      run(csrfProtection, admin("/admin/invites", "multipart/form-data; boundary=x")).status()
    ).toBe(403)
    // Medusa's own product import is closed: no multipart there any more (F3.9)
    expect(
      run(
        csrfProtection,
        admin("/admin/products/imports", "multipart/form-data; boundary=x")
      ).status()
    ).toBe(403)
    // The product sheet: its own bytes, typed as no form can send them, on its own path only
    const xlsx = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    expect(run(csrfProtection, admin("/admin/catalog/imports", xlsx)).next).toHaveBeenCalled()
    expect(run(csrfProtection, admin("/admin/catalog/imports", "text/csv")).next).toHaveBeenCalled()
    expect(run(csrfProtection, admin("/admin/catalog/imports", "text/plain")).status()).toBe(403)
    // An invoice's PDF (F8): only as a PDF, only on an invoice's own PDF path
    const pdf = "application/pdf"
    expect(run(csrfProtection, admin("/admin/invoices/inv_1/pdf", pdf)).next).toHaveBeenCalled()
    expect(run(csrfProtection, admin("/admin/invoices/inv_1/issued", pdf)).status()).toBe(403)
    expect(run(csrfProtection, admin("/admin/catalog/imports", pdf)).status()).toBe(403)
    expect(run(csrfProtection, admin("/admin/products", xlsx)).status()).toBe(403)
    // A WordPress export for a migration (adr/0042 Ek 2026-11-03): XML or zip, on its own path only
    expect(run(csrfProtection, admin("/admin/migrations", "text/xml")).next).toHaveBeenCalled()
    expect(
      run(csrfProtection, admin("/admin/migrations", "application/xml; charset=utf-8")).next
    ).toHaveBeenCalled()
    expect(run(csrfProtection, admin("/admin/migrations", "text/plain")).status()).toBe(403)
    expect(run(csrfProtection, admin("/admin/migrations/feed", "text/xml")).status()).toBe(403)
  })

  it("lets an admin DELETE without a body through", () => {
    const req = request({
      path: "/admin/products/p1",
      method: "DELETE",
      headers: { cookie: COOKIE, origin: adminOrigin },
    })

    expect(run(csrfProtection, req).next).toHaveBeenCalled()
  })
})

describe("storeLimitGuard", () => {
  it.each([
    [{}, null],
    [{ limit: "100" }, null],
    [{ limit: "0" }, null],
    [{ limit: "101" }, "errors.limit_too_large"],
    // Medusa's parseInt would read these as large or negative numbers
    [{ limit: "101abc" }, "errors.invalid_limit"],
    [{ limit: "-1" }, "errors.invalid_limit"],
    [{ limit: " 101" }, "errors.invalid_limit"],
    [{ limit: "1e3" }, "errors.invalid_limit"],
    [{ limit: ["5", "500"] }, "errors.invalid_limit"],
  ])("handles %p", (query, refusal) => {
    const result = run(storeLimitGuard, request({ method: "GET", query }))

    if (refusal === null) {
      expect(result.next).toHaveBeenCalled()
    } else {
      expect(result.next).not.toHaveBeenCalled()
      expect(result.status()).toBe(400)
      expect(result.body()).toMatchObject({ message: refusal })
    }
  })
})

describe("adminLimitGuard", () => {
  it.each([
    // Product create asks for 9999 regions and price preferences
    [{ limit: "9999" }, null],
    [{ limit: "20" }, null],
    [{ limit: "10000" }, "errors.limit_too_large"],
    [{ limit: "100000" }, "errors.invalid_limit"],
    [{ limit: "1000x" }, "errors.invalid_limit"],
  ])("handles %p", (query, refusal) => {
    const result = run(adminLimitGuard, request({ method: "GET", path: "/admin/products", query }))

    if (refusal === null) {
      expect(result.next).toHaveBeenCalled()
    } else {
      expect(result.status()).toBe(400)
      expect(result.body()).toMatchObject({ message: refusal })
    }
  })
})

describe("uploadSizeGate", () => {
  const multipart = (path: string, length?: string) =>
    request({
      path,
      headers: {
        "content-type": "Multipart/Form-Data; boundary=x",
        ...(length === undefined ? {} : { "content-length": length }),
      },
    })

  it("refuses a missing or oversized length before the upload is read", () => {
    expect(run(uploadSizeGate, multipart("/admin/uploads")).status()).toBe(411)
    expect(
      run(uploadSizeGate, multipart("/admin/uploads", String(30 * 1024 * 1024))).status()
    ).toBe(413)
    expect(run(uploadSizeGate, multipart("/admin/uploads", "1024")).next).toHaveBeenCalled()
  })

  it("checks every multipart request, however the path is spelled", () => {
    expect(run(uploadSizeGate, multipart("/ADMIN/UPLOADS")).status()).toBe(411)
    expect(run(uploadSizeGate, multipart("/admin/products/import")).status()).toBe(411)
  })

  it("leaves other bodies to the body parser's own limit", () => {
    const json = request({
      path: "/admin/products",
      headers: { "content-type": "application/json" },
    })

    expect(run(uploadSizeGate, json).next).toHaveBeenCalled()
  })
})

describe("rejectAmbiguousPath", () => {
  it.each([
    "/auth\\customer\\emailpass\\reset-password#",
    "/admin/products#x",
    "/admin\\products",
    "/admin/gift-cards/../orders",
    "/admin/gift-cards/%2e%2E/orders",
    "/admin/./orders",
    "/admin/webhooks/%2E",
  ])("refuses %s", (path) => {
    const result = run(rejectAmbiguousPath, request({ path }))

    expect(result.status()).toBe(400)
    expect(result.body()).toMatchObject({ message: "errors.invalid_request" })
  })

  it("lets an ordinary path through, encoded characters included", () => {
    const req = request({ path: "/admin/products/prod%5F01.v2?q=%23/../" })

    expect(run(rejectAmbiguousPath, req).next).toHaveBeenCalled()
  })
})

describe("routePath", () => {
  const request = (url: string) => ({ originalUrl: url }) as unknown as MedusaRequest

  it("reads the path as Express routes it", () => {
    expect(routePath(request("/ADMIN/Products//?q=1"))).toBe("/admin/products")
    expect(routePath(request("///"))).toBe("/")
  })

  it("trims a long run of slashes in linear time", () => {
    const start = performance.now()
    routePath(request(`/auth/${"/".repeat(16_000)}x`))
    routePath(request(`/auth${"/".repeat(16_000)}`))
    // The regex it replaces took ~90 ms for one of these
    expect(performance.now() - start).toBeLessThan(50)
  })
})
