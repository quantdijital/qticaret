import { request as httpRequest } from "node:http"
import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

const firstOrigin = (list: string | undefined) =>
  new URL((list ?? "").split(",")[0]?.trim() ?? "").origin

const SECURITY_HEADERS = {
  "x-content-type-options": "nosniff",
  "x-frame-options": "DENY",
  "content-security-policy": "default-src 'none'; frame-ancestors 'none'",
  "referrer-policy": "no-referrer",
}

const expectSecurityHeaders = (response: HttpResponse<unknown>) => {
  expect(response.headers).toMatchObject(SECURITY_HEADERS)
  expect(response.headers).not.toHaveProperty("x-powered-by")
}

function sessionCookie(response: HttpResponse<unknown>): string {
  const header = response.headers["set-cookie"]
  const cookies = Array.isArray(header) ? header : header ? [header] : []
  const cookie = cookies.find((value) => value.startsWith("connect.sid="))
  if (!cookie) {
    throw new Error("no session cookie was set")
  }
  return cookie.split(";")[0] ?? ""
}

/** F2.10b (docs/04): rate limits, security headers, CSRF, request bounds, CORS. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
    })

    it("answers 429 with Retry-After after ten failed logins for one account (F2 KK)", async () => {
      // An account that never logged in, so every attempt in the window is ours
      const email = `nobody-${randomUUID()}@example.com`
      const attempt = (path = "/auth/customer/emailpass") =>
        settle(http.post(path, { email, password: `wrong-${randomUUID()}` }))

      for (let index = 0; index < 10; index++) {
        expect((await attempt()).status).toBe(401)
      }
      // The same route spelled with a trailing slash shares the count
      const limited = await attempt("/auth/customer/emailpass/")

      expect(limited.status).toBe(429)
      expect(Number(limited.headers["retry-after"])).toBeGreaterThan(0)
      expect(limited.data).toMatchObject({
        type: "too_many_requests",
        message: "errors.too_many_requests",
      })
      expectSecurityHeaders(limited)
    })

    it("puts the security headers on answers and errors (F2 KK)", async () => {
      expectSecurityHeaders(await http.get("/store/regions", { headers: storefront.headers }))
      // Medusa's publishable key error, through our error handler
      expectSecurityHeaders(await settle(http.get("/store/regions")))
      // A middleware rejection
      expectSecurityHeaders(
        await settle(http.get("/store/products?limit=101", { headers: storefront.headers }))
      )
    })

    it("refuses a store limit above 100, or one that is not a plain number", async () => {
      const list = (limit: string) =>
        settle(http.get(`/store/products?limit=${limit}`, { headers: storefront.headers }))

      const over = await list("101")
      const padded = await list("100000x")
      const at = await list("100")

      expect(over.status).toBe(400)
      expect(over.data).toMatchObject({ message: "errors.limit_too_large" })
      expect(padded.status).toBe(400)
      expect(padded.data).toMatchObject({ message: "errors.invalid_limit" })
      expect(at.status).toBe(200)
    })

    it("refuses a cookie mutation from another origin and accepts an allowed one", async () => {
      const customer = await registerCustomer(http, storefront)
      const session = await http.post(
        "/auth/session",
        {},
        { headers: { authorization: customer.headers["authorization"] ?? "" } }
      )
      const cookie = sessionCookie(session)
      const update = (origin: string) =>
        settle(
          http.post(
            "/store/customers/me",
            { first_name: "Ayşe" },
            { headers: { ...storefront.headers, cookie, origin } }
          )
        )

      const forged = await update("https://evil.example")
      const allowed = await update(firstOrigin(process.env["STORE_CORS"]))

      expect(forged.status).toBe(403)
      expect(forged.data).toMatchObject({ message: "errors.csrf_rejected" })
      expect(allowed.status).toBe(200)
    })

    it("lets the admin dashboard's JSON requests through and refuses forms and other origins", async () => {
      const admin = await createAdminUser(http, getContainer())
      const session = await http.post("/auth/session", {}, { headers: admin.headers })
      const cookie = sessionCookie(session)
      const adminOrigin = firstOrigin(process.env["ADMIN_CORS"])
      const createRegion = (headers: Record<string, string>, body: unknown) =>
        settle(http.post("/admin/regions", body, { headers: { cookie, ...headers } }))

      const json = await createRegion(
        { origin: adminOrigin, "content-type": "application/json" },
        { name: `Bölge ${randomUUID()}`, currency_code: "try" }
      )
      const form = await createRegion(
        { origin: adminOrigin, "content-type": "application/x-www-form-urlencoded" },
        "name=x&currency_code=try"
      )
      const elsewhere = await createRegion(
        { origin: "https://evil.example", "content-type": "application/json" },
        { name: "x", currency_code: "try" }
      )
      // Express routes the upper-case path to the same handler
      const upperCase = await settle(
        http.post("/ADMIN/regions", "name=x&currency_code=try", {
          headers: {
            cookie,
            origin: "https://evil.example",
            "content-type": "application/x-www-form-urlencoded",
          },
        })
      )

      expect(json.status).toBe(200)
      for (const refused of [form, elsewhere, upperCase]) {
        expect(refused.status).toBe(403)
        // A session request is the dashboard's: the key comes in `code` (adr/0021)
        expect(refused.data).toMatchObject({ code: "errors.csrf_rejected" })
      }
    })

    it("refuses an oversized upload before reading its body", async () => {
      const admin = await createAdminUser(http, getContainer())
      // The client is ready only once tests run
      const baseUrl = (api as { defaults: { baseURL: string } }).defaults.baseURL
      const url = new URL("/admin/uploads", baseUrl)

      // Declares 50 MB and sends a few bytes: only a check that runs before
      // multer can answer without waiting for the rest
      const status = await new Promise<number>((resolve, reject) => {
        const req = httpRequest(
          url,
          {
            method: "POST",
            headers: {
              ...admin.headers,
              "content-type": "multipart/form-data; boundary=x",
              "content-length": String(50 * 1024 * 1024),
            },
          },
          (res) => {
            res.resume()
            resolve(res.statusCode ?? 0)
          }
        )
        req.on("error", reject)
        req.setTimeout(5000, () => {
          req.destroy(new Error("no answer: the body was being read"))
        })
        req.write("--x\r\n")
      })

      expect(status).toBe(413)
    })

    it.each([
      ["/admin/regions", "ADMIN_CORS"],
      ["/auth/customer/emailpass", "AUTH_CORS"],
    ])("allows only listed origins on %s", async (path, list) => {
      const preflight = (origin: string) =>
        settle(
          http.options(path, {
            headers: { origin, "access-control-request-method": "POST" },
          })
        )
      const allowedOrigin = firstOrigin(process.env[list])

      const evil = await preflight("https://evil.example")
      const allowed = await preflight(allowedOrigin)

      expect(evil.headers["access-control-allow-origin"]).toBeUndefined()
      expect(allowed.headers["access-control-allow-origin"]).toBe(allowedOrigin)
    })

    it("does not allow an origin outside the store list", async () => {
      // Medusa asks for the publishable key before answering a store
      // preflight, so even a listed origin gets no allow header here (F18)
      const evil = await settle(
        http.options("/store/regions", {
          headers: { origin: "https://evil.example", "access-control-request-method": "POST" },
        })
      )

      expect(evil.headers["access-control-allow-origin"]).toBeUndefined()
    })
  },
})
