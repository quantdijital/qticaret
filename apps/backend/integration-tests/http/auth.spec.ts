import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import type { TestCustomer } from "../helpers/customer"
import { confirmEmail, registerCustomer } from "../helpers/customer"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"
import type { Storefront } from "../helpers/storefront"
import { createStorefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface MeResponse {
  customer: { id: string }
}

interface LoginResponse {
  token: string
  verification_required?: boolean
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
 * resolve the same customer. adr/0037: an e-mail login works once its
 * address is confirmed.
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
      // Secure is only left off in an explicitly local environment (test here)
      expect(cookie).not.toMatch(/;\s*Secure/i)
      // Session lifetime: 10 hours (medusa-config sessionOptions.ttl)
      const expires = Date.parse(/Expires=([^;]+)/i.exec(cookie)?.[1] ?? "")
      expect((expires - Date.now()) / 3_600_000).toBeCloseTo(10, 0)

      const cookieHeader = cookie.split(";")[0] ?? ""
      const response = await me({ ...storefront.headers, cookie: cookieHeader })
      expect(response.status).toBe(200)
      expect(response.data.customer.id).toBe(customer.id)
    })

    it("session: logging out invalidates the cookie", async () => {
      const created = await http.post("/auth/session", {}, { headers: customer.headers })
      const cookie = { ...storefront.headers, cookie: sessionCookie(created).split(";")[0] ?? "" }

      // A browser sends its origin; CSRF protection (F2.10) requires an allowed one
      const origin = new URL((process.env["AUTH_CORS"] ?? "").split(",")[0]?.trim() ?? "").origin
      const loggedOut = await settle(
        http.delete("/auth/session", { headers: { ...cookie, origin } })
      )
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

    it("takes a new password only by the rule, for customers and staff alike (F15.1)", async () => {
      const register = (
        actor: "customer" | "user",
        password: string,
        email = `kayit-${randomUUID()}@example.com`
      ) =>
        settle(
          http.post<{ token?: string; type?: string; message?: string }>(
            `/auth/${actor}/emailpass/register`,
            { email, password }
          )
        )

      const short = await register("customer", "kisa-sif")
      const common = await register("customer", "Galatasaray1905")
      const named = await register("customer", "Selin.Yildiz-2024", "selin.yildiz@example.com")
      const staff = await register("user", "1234567890")
      // Throwaway credential for this test database only
      const good = await register("customer", `mavi kuş ${randomUUID()}`)

      expect(short.status).toBe(400)
      expect(short.data).toMatchObject({ type: "invalid_data", message: "auth.password_too_short" })
      expect(common.data).toMatchObject({ message: "auth.password_common" })
      expect(named.data).toMatchObject({ message: "auth.password_contains_email" })
      expect(staff.data).toMatchObject({ message: "auth.password_common" })
      expect(good.status).toBe(200)
      expect(good.data.token).toEqual(expect.any(String))
    })

    it("opens an account for the registering address only, and lets it in once confirmed", async () => {
      const email = `kayit-${randomUUID()}@example.com`
      // Throwaway credential for this test database only
      const password = randomUUID()
      const registration = await http.post<{ token: string }>("/auth/customer/emailpass/register", {
        email,
        password,
      })
      const bearer = (token: string) => ({
        ...storefront.headers,
        authorization: `Bearer ${token}`,
      })
      // A stranger's address in the body opens nothing in their name
      const created = await http.post<{ customer: { email: string } }>(
        "/store/customers",
        { email: "baskasi@example.com", first_name: "Ayşe" },
        { headers: bearer(registration.data.token) }
      )
      const early = await http.post<LoginResponse>("/auth/customer/emailpass", { email, password })
      const earlyMe = await me(bearer(early.data.token))
      await confirmEmail(http, getContainer(), registration.data.token, email)
      const login = await http.post<LoginResponse>("/auth/customer/emailpass", { email, password })
      const later = await me(bearer(login.data.token))

      expect(created.data.customer.email).toBe(email)
      expect(early.data.verification_required).toBe(true)
      expect(earlyMe.status).toBe(401)
      expect(login.data.verification_required).toBeUndefined()
      expect(later.status).toBe(200)
    })
  },
})
