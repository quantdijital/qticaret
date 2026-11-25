import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { fakeAppleAccount, startFakeApple } from "@qticaret/testing"
import type { FakeApple } from "@qticaret/testing"
import { registerCustomer } from "../helpers/customer"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { namedPort } from "../helpers/port"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

// The auth providers are read when the app starts, before any hook: the
// fake Apple's address and client are set here, its server started later
const account = fakeAppleAccount()
const port = namedPort()
const CALLBACK = "https://magaza.example.com/hesap/giris/apple"
Object.assign(process.env, {
  APPLE_AUTH_CLIENT_ID: account.clientId,
  APPLE_AUTH_TEAM_ID: account.teamId,
  APPLE_AUTH_KEY_ID: account.keyId,
  APPLE_AUTH_PRIVATE_KEY: account.privateKey.replace(/\n/g, "\\n"),
  APPLE_AUTH_CALLBACK_URL: CALLBACK,
  APPLE_AUTH_BASE_URL: `http://127.0.0.1:${String(port)}`,
})

interface TokenBody {
  token?: string
  location?: string
}

/** F10.2 (adr/0037 §3): Sign in with Apple, and when it joins an account that exists. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let apple: FakeApple
    let storefront: Storefront

    /** The storefront's part: start, Apple's answer posted back, the token. */
    const signIn = async (
      email: string,
      change: { nonce?: string; forged?: boolean; emailVerified?: boolean } = {}
    ) => {
      const start = await http.post<TokenBody>("/auth/customer/apple", {})
      const location = new URL(start.data.location ?? "https://none.example")
      const state = location.searchParams.get("state") ?? ""
      const code = apple.issue({
        sub: `001234.${randomUUID()}`,
        email,
        nonce: change.nonce ?? location.searchParams.get("nonce") ?? "",
        ...(change.forged ? { forged: true } : {}),
        ...(change.emailVerified === false ? { emailVerified: false } : {}),
      })
      const back = () =>
        settle(
          http.post<TokenBody>("/auth/customer/apple/callback", {
            code,
            state,
            user: JSON.stringify({ name: { firstName: "Ayşe", lastName: "<b>Yılmaz</b>" } }),
          })
        )
      return { location, back }
    }
    const bearer = (token: string) => ({
      ...storefront.headers,
      authorization: `Bearer ${token}`,
    })
    const openAccount = (token: string) =>
      settle(
        http.post<{ customer?: { id: string; email: string }; message?: string }>(
          "/store/customers",
          { first_name: "Ayşe", email: "baskasi@example.com" },
          { headers: bearer(token) }
        )
      )
    const meWith = async (token: string) => {
      const refreshed = await http.post<TokenBody>(
        "/auth/token/refresh",
        {},
        { headers: bearer(token) }
      )
      return settle(
        http.get<{ customer: { id: string; email: string } }>("/store/customers/me", {
          headers: bearer(refreshed.data.token ?? ""),
        })
      )
    }

    beforeAll(async () => {
      apple = await startFakeApple(account, { port })
    })

    afterAll(async () => {
      await apple.close()
    })

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
    })

    it("signs a new customer in with Apple and opens their account for Apple's address", async () => {
      const email = `apple-${String(Date.now())}@privaterelay.example`
      const { location, back } = await signIn(email)
      const callback = await back()
      const opened = await openAccount(callback.data.token ?? "")
      const me = await meWith(callback.data.token ?? "")

      expect(location.origin).toBe(`http://127.0.0.1:${String(port)}`)
      expect(location.searchParams.get("redirect_uri")).toBe(CALLBACK)
      expect(location.searchParams.get("response_mode")).toBe("form_post")
      expect(callback.status).toBe(200)
      expect(opened.data.customer?.email).toBe(email)
      expect(me.data.customer.email).toBe(email)
      expect(apple.refused()).toBe(0)
    })

    it("refuses a token for another sign-in, a forged one, an unverified address and a code twice", async () => {
      const email = `apple-red-${String(Date.now())}@privaterelay.example`
      const otherNonce = await signIn(email, { nonce: "baska-bir-giris" })
      const forged = await signIn(email, { forged: true })
      const unverified = await signIn(email, { emailVerified: false })
      const good = await signIn(email)

      const answers = [await otherNonce.back(), await forged.back(), await unverified.back()]
      const first = await good.back()
      const again = await good.back()

      for (const answer of answers) {
        expect(answer.data.token).toBeUndefined()
      }
      expect(first.data.token).toBeTruthy()
      expect(again.data.token).toBeUndefined()
    })

    it("joins the account of a confirmed e-mail login with the same address", async () => {
      const existing = await registerCustomer(http, storefront)
      const { back } = await signIn(existing.email)
      const callback = await back()
      const joined = await openAccount(callback.data.token ?? "")
      const me = await meWith(callback.data.token ?? "")

      expect(joined.status).toBe(200)
      expect(joined.data.customer?.id).toBe(existing.id)
      expect(me.data.customer.id).toBe(existing.id)
    })

    it("joins no account whose address was never confirmed", async () => {
      const email = `onaysiz-${String(Date.now())}@example.com`
      const registration = await http.post<TokenBody>("/auth/customer/emailpass/register", {
        email,
        password: randomUUID(),
      })
      await openAccount(registration.data.token ?? "")
      const { back } = await signIn(email)
      const callback = await back()
      const refused = await openAccount(callback.data.token ?? "")

      expect(refused.status).toBe(422)
      expect(refused.data.customer).toBeUndefined()
    })

    it("offers customers no provider the shop has not set up, and staff e-mail only", async () => {
      const google = await settle(http.post("/auth/customer/google", {}))
      const staffApple = await settle(http.post("/auth/user/apple", {}))

      expect(google.status).not.toBe(200)
      expect(staffApple.status).not.toBe(200)
    })
  },
})
