import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { setUpTotp } from "../helpers/mfa"
import { settle } from "../helpers/http"
import { totp } from "../helpers/totp"

jest.setTimeout(120 * 1000)

interface Login {
  token: string
  mfa_challenge?: { id: string; methods: string[] }
}

const bearer = (token: string) => ({ authorization: `Bearer ${token}` })

// The proof a sensitive change asks of someone with 2FA: the step before the sign-in's code
const withCode = (headers: Record<string, string>, secret: string) => ({
  ...headers,
  "x-reauth-method": "totp",
  "x-reauth-secret": totp(secret, -1),
})

/** F12.6 (adr/0040 §2; KK1): no staff member past their own page without 2FA. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    beforeAll(() => {
      process.env["ADMIN_MFA"] = "on"
    })

    afterAll(() => {
      process.env["ADMIN_MFA"] = "off"
    })

    const signIn = (email: string, password: string) =>
      http.post<Login>("/auth/user/emailpass", { email, password })

    it("keeps an owner without 2FA to their own page, and lets them in once it is passed (KK1)", async () => {
      const owner = await createAdminUser(http, getContainer())

      const before = await settle(
        http.get<{ message: string }>("/admin/orders?limit=1", { headers: owner.headers })
      )
      const me = await http.get<{ mfa: Record<string, boolean> }>("/admin/staff/me", {
        headers: owner.headers,
      })
      const { secret, codes } = await setUpTotp(http, owner)
      const login = await signIn(owner.email, owner.password)
      const challenge = login.data.mfa_challenge
      const wrong = await settle(
        http.post(
          `/auth/mfa/challenges/${challenge?.id ?? ""}/verify`,
          { method: "totp", code: "000000" },
          { headers: bearer(login.data.token) }
        )
      )
      // The next step's code: the setup's own was just used
      const passed = await http.post<{ token: string }>(
        `/auth/mfa/challenges/${challenge?.id ?? ""}/verify`,
        { method: "totp", code: totp(secret, 1) },
        { headers: bearer(login.data.token) }
      )
      const after = await http.get("/admin/orders?limit=1", { headers: bearer(passed.data.token) })
      const meAfter = await http.get<{ mfa: Record<string, boolean> }>("/admin/staff/me", {
        headers: bearer(passed.data.token),
      })

      expect(before.status).toBe(403)
      expect(before.data.message).toBe("staff.mfa_required")
      expect(me.data.mfa).toEqual({
        available: true,
        required: true,
        enabled: false,
        passed: false,
      })
      expect(codes.length).toBeGreaterThan(0)
      expect(challenge?.methods).toEqual(expect.arrayContaining(["totp", "recovery_code"]))
      expect(wrong.status).toBeGreaterThanOrEqual(400)
      expect(after.status).toBe(200)
      expect(meAfter.data.mfa).toEqual({
        available: true,
        required: true,
        enabled: true,
        passed: true,
      })
    })

    it("takes a recovery code once, for a phone left at home", async () => {
      const member = await createAdminUser(http, getContainer(), "admin")
      const { codes } = await setUpTotp(http, member)
      const code = codes[0] ?? ""

      const first = await signIn(member.email, member.password)
      const used = await http.post<{ token: string }>(
        `/auth/mfa/challenges/${first.data.mfa_challenge?.id ?? ""}/verify`,
        { method: "recovery_code", code },
        { headers: bearer(first.data.token) }
      )
      const second = await signIn(member.email, member.password)
      const again = await settle(
        http.post(
          `/auth/mfa/challenges/${second.data.mfa_challenge?.id ?? ""}/verify`,
          { method: "recovery_code", code },
          { headers: bearer(second.data.token) }
        )
      )
      const reached = await http.get("/admin/orders?limit=1", { headers: bearer(used.data.token) })

      expect(reached.status).toBe(200)
      expect(again.status).toBeGreaterThanOrEqual(400)
    })

    it("starts a setup left half-way again: its pending factor goes first", async () => {
      const member = await createAdminUser(http, getContainer(), "admin")
      const headers = bearer(member.headers["authorization"]?.slice(7) ?? "")
      const start = () =>
        settle(
          http.post<{ mfa_factor: { id: string }; secret: string }>(
            "/auth/mfa/factors",
            { provider: "totp", label: "Panel" },
            { headers }
          )
        )

      const first = await start()
      const blocked = await start()
      const dropped = await settle(
        http.delete(`/auth/mfa/factors/${first.data.mfa_factor.id}`, { headers })
      )
      const again = await start()

      expect(first.status).toBe(200)
      expect(blocked.status).toBe(400)
      expect(dropped.status).toBe(200)
      expect(again.status).toBe(200)
    })

    it("lets the owner switch 2FA off for the team, and no one else", async () => {
      const owner = await createAdminUser(http, getContainer())
      const { secret } = await setUpTotp(http, owner)
      const login = await signIn(owner.email, owner.password)
      const passed = await http.post<{ token: string }>(
        `/auth/mfa/challenges/${login.data.mfa_challenge?.id ?? ""}/verify`,
        { method: "totp", code: totp(secret, 1) },
        { headers: bearer(login.data.token) }
      )
      const member = await createAdminUser(http, getContainer(), "admin")
      const switchTo = (headers: Record<string, string>, on: boolean) =>
        settle(
          http.post("/admin/platform-settings/security", { staff_mfa_required: on }, { headers })
        )

      const before = await settle(http.get("/admin/orders?limit=1", { headers: member.headers }))
      // Turning it off asks the owner for a code (adr/0040 §3)
      const byOwner = await switchTo(withCode(bearer(passed.data.token), secret), false)
      const after = await settle(http.get("/admin/orders?limit=1", { headers: member.headers }))
      const me = await http.get<{ mfa: Record<string, boolean> }>("/admin/staff/me", {
        headers: member.headers,
      })
      // Off: who set it up is still asked for the code at sign-in
      const ownerAgain = await signIn(owner.email, owner.password)
      await switchTo(bearer(passed.data.token), true)
      const memberMayNot = await switchTo(member.headers, false)

      expect(before.status).toBe(403)
      expect(byOwner.status).toBe(200)
      expect(after.status).toBe(200)
      expect(me.data.mfa).toMatchObject({ available: true, required: false })
      expect(ownerAgain.data.mfa_challenge).toBeDefined()
      expect(memberMayNot.status).toBe(403)
    })

    it("asks no 2FA of an API key: it has its own scopes", async () => {
      const owner = await createAdminUser(http, getContainer())
      const { secret } = await setUpTotp(http, owner)
      const login = await signIn(owner.email, owner.password)
      const passed = await http.post<{ token: string }>(
        `/auth/mfa/challenges/${login.data.mfa_challenge?.id ?? ""}/verify`,
        { method: "totp", code: totp(secret, 1) },
        { headers: bearer(login.data.token) }
      )
      // A new key asks for the code again (adr/0040 §3): the step before the sign-in's
      const made = await http.post<{ token: string }>(
        "/admin/api-access",
        { title: "Depo", scopes: ["orders:read"] },
        { headers: withCode(bearer(passed.data.token), secret) }
      )

      const read = await settle(
        http.get("/admin/orders?limit=1", {
          headers: {
            authorization: `Basic ${Buffer.from(`${made.data.token}:`).toString("base64")}`,
          },
        })
      )

      expect(read.status).toBe(200)
    })
  },
})
