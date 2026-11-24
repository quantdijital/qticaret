import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { resetTurnstile } from "../../src/api/http/turnstile"
import { solveChallenge } from "../../src/lib/security/challenge"
import {
  TURNSTILE_TEST_SECRET_FAIL,
  TURNSTILE_TEST_SECRET_SPENT,
  TURNSTILE_TEST_SITE_KEY,
  createTurnstileClient,
} from "../../src/lib/security/turnstile"
import { NO_TURNSTILE } from "../helpers/challenge"
import type { GivenChallenge } from "../helpers/challenge"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"

jest.setTimeout(120 * 1000)

interface Answer {
  message?: string
  turnstile?: { action?: string; site_key?: string | null }
  challenge?: GivenChallenge
  fallback?: string
  token?: string
}

// A made-up key in Cloudflare's shape: not a test key, so siteverify is asked
const MADE_UP_SECRET = "0x4AAAAAAAmadeUpForThisTestOnly"
const MADE_UP_SITE = "0x4AAAAAAAmadeUpSiteKeyForTests"

// Unset is the default here (the test keys); a blank value counts as unset
const setKeys = (site: string | undefined, secret: string | undefined) => {
  process.env["TURNSTILE_SITE_KEY"] = site ?? ""
  process.env["TURNSTILE_SECRET_KEY"] = secret ?? ""
}

/**
 * adr/0044 Ek 2026-11-24: Cloudflare Turnstile at the risky gates. Unset
 * keys are Cloudflare's always-pass test keys here (setup.js sends their
 * dummy token on every request); the always-fail and spent test secrets
 * prove a refusal; a Cloudflare that cannot answer falls back to our proof
 * of work.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let storefront: Storefront
    const site = process.env["TURNSTILE_SITE_KEY"]
    const secret = process.env["TURNSTILE_SECRET_KEY"]

    const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
      settle(http.post<Answer>(path, body, { headers: { ...storefront.headers, ...headers } }))
    const signIn = (headers: Record<string, string> = {}) =>
      post(
        "/auth/customer/emailpass",
        { email: `yok-${randomUUID()}@example.com`, password: "yanlis-sifre-123" },
        headers
      )

    beforeEach(async () => {
      storefront = await createStorefront(getContainer())
    })

    afterEach(() => {
      setKeys(site, secret)
      resetTurnstile()
    })

    it("gives the site key to the storefront and the panel's sign-in, never the secret", async () => {
      const store = await settle(
        http.get<Answer>("/store/storefront", { headers: storefront.headers })
      )
      const panel = await settle(http.get<Answer>("/admin/public-config"))

      expect(store.data.turnstile).toEqual({ site_key: TURNSTILE_TEST_SITE_KEY })
      expect([panel.status, panel.data]).toEqual([
        200,
        { turnstile: { site_key: TURNSTILE_TEST_SITE_KEY } },
      ])
      expect(JSON.stringify(panel.data)).not.toContain("1x0000000000000000000000000000000AA")
    })

    it("asks a token at every always-on gate, and lets the test token through", async () => {
      // A code is asked by a signed-in identity: Medusa's own authentication may answer first
      const made = await post("/auth/customer/emailpass/register", {
        email: `kod-${randomUUID()}@example.com`,
        password: `Uzun-${randomUUID()}`,
      })
      const signedIn = { authorization: `Bearer ${made.data.token ?? ""}` }
      const gates: [string, string, unknown, Record<string, string>?][] = [
        ["/auth/customer/emailpass", "login", { email: "a@example.com", password: "x" }],
        [
          "/auth/customer/emailpass/register",
          "register",
          { email: "a@example.com", password: "x" },
        ],
        [
          "/auth/customer/emailpass/reset-password",
          "password_reset",
          { identifier: "a@example.com" },
        ],
        ["/auth/user/emailpass", "staff_login", { email: "a@example.com", password: "x" }],
        [
          "/auth/user/emailpass/reset-password",
          "staff_password_reset",
          { identifier: "a@example.com" },
        ],
        [
          "/auth/user/emailpass/register",
          "staff_register",
          { email: "a@example.com", password: "x" },
        ],
        [
          "/auth/verification/request",
          "verification",
          { entity_id: "a@example.com", entity_type: "email" },
          signedIn,
        ],
        [
          `/store/carts/cart_${randomUUID()}/payment-session`,
          "checkout",
          { provider_id: "pp_cod_cod" },
        ],
      ]
      expect(made.status).toBe(200)
      for (const [path, action, body, headers = {}] of gates) {
        const bare = await post(path, body, { ...headers, ...NO_TURNSTILE })
        expect([path, bare.status, bare.data.message, bare.data.turnstile]).toEqual([
          path,
          428,
          "fraud.turnstile_required",
          { action },
        ])
      }
      // Past the gate, the route's own answer: a wrong password is Medusa's 401
      expect((await signIn()).status).toBe(401)
    })

    it("refuses a token the always-fail and the spent test secrets refuse", async () => {
      for (const refusing of [TURNSTILE_TEST_SECRET_FAIL, TURNSTILE_TEST_SECRET_SPENT]) {
        setKeys("2x00000000000000000000AB", refusing)
        resetTurnstile()
        const refused = await signIn()
        expect([refused.status, refused.data.message, refused.data.turnstile]).toEqual([
          403,
          "fraud.turnstile_failed",
          { action: "login" },
        ])
      }
    })

    it("falls back to the proof of work when Cloudflare cannot answer, its answer taken once", async () => {
      setKeys(MADE_UP_SITE, MADE_UP_SECRET)
      resetTurnstile(
        createTurnstileClient({
          transport: () => Promise.reject(new Error("connect ECONNREFUSED")),
          sleep: () => Promise.resolve(),
        })
      )
      const asked = await signIn({ "x-turnstile-token": "a-real-looking-token" })
      expect([asked.status, asked.data.message, asked.data.fallback]).toEqual([
        428,
        "fraud.challenge_required",
        "turnstile_unavailable",
      ])
      const challenge = asked.data.challenge
      if (!challenge) {
        throw new Error("no challenge was given")
      }
      const answer = `${challenge.token}.${solveChallenge(challenge.salt, challenge.bits)}`
      const passed = await signIn({ "x-turnstile-fallback": answer })
      const again = await signIn({ "x-turnstile-fallback": answer })
      // A login proof of work is not Turnstile's stand-in
      const other = await signIn({ "x-challenge": answer })

      expect(passed.status).toBe(401)
      expect(again.status).toBe(428)
      expect(other.status).toBe(428)
    })
  },
})
