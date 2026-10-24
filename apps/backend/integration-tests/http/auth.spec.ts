import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { TestCustomer } from "../helpers/customer"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface MeResponse {
  customer: { id: string }
}

function sessionCookie(response: HttpResponse<unknown>): string {
  const header = response.headers["set-cookie"]
  const cookies = Array.isArray(header) ? header : header ? [header] : []
  const cookie = cookies.find((value) => value.startsWith("connect.sid="))
  if (!cookie) {
    throw new Error("no session cookie was set")
  }
  return cookie
}

/**
 * adr/0004: web storefronts use an httpOnly session cookie created from the
 * login token; mobile and third-party clients use the bearer token. Both
 * resolve the same customer.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront
    let customer: TestCustomer

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
      customer = await registerCustomer(http, storefront)
    })

    const me = (headers: Record<string, string>) =>
      settle(http.get<MeResponse>("/store/customers/me", { headers }))

    it("bearer: the login token authenticates Store API requests", async () => {
      const response = await me(customer.headers)

      expect(response.status).toBe(200)
      expect(response.data.customer.id).toBe(customer.id)
    })

    it("session: the token becomes an httpOnly, SameSite=Lax cookie that authenticates alone", async () => {
      const created = await http.post("/auth/session", {}, { headers: customer.headers })
      const cookie = sessionCookie(created)

      expect(cookie).toMatch(/;\s*HttpOnly/i)
      expect(cookie).toMatch(/;\s*SameSite=Lax/i)
      // Secure is only set when deployed (staging/production)
      expect(cookie).not.toMatch(/;\s*Secure/i)

      const cookieHeader = cookie.split(";")[0] ?? ""
      const response = await me({ ...storefront.headers, cookie: cookieHeader })
      expect(response.status).toBe(200)
      expect(response.data.customer.id).toBe(customer.id)
    })

    it("session: logging out invalidates the cookie", async () => {
      const created = await http.post("/auth/session", {}, { headers: customer.headers })
      const cookie = { ...storefront.headers, cookie: sessionCookie(created).split(";")[0] ?? "" }

      const loggedOut = await settle(http.delete("/auth/session", { headers: cookie }))
      expect(loggedOut.status).toBe(200)

      expect((await me(cookie)).status).toBe(401)
    })

    it.each([
      ["no credentials", {}],
      ["a forged bearer token", { authorization: "Bearer not.a.token" }],
      ["an unknown session cookie", { cookie: "connect.sid=s%3Aforged.signature" }],
    ])("rejects %s with 401", async (_case, headers) => {
      expect((await me({ ...storefront.headers, ...headers })).status).toBe(401)
    })

    it("token refresh issues a new token for the same customer", async () => {
      const refreshed = await http.post<{ token: string }>(
        "/auth/token/refresh",
        {},
        { headers: customer.headers }
      )
      const response = await me({
        ...storefront.headers,
        authorization: `Bearer ${refreshed.data.token}`,
      })

      expect(response.data.customer.id).toBe(customer.id)
    })
  },
})
