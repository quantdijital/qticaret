import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CP_AUDIT_MODULE } from "../../src/modules/cp-audit"
import type CpAuditModuleService from "../../src/modules/cp-audit/service"
import { inviteFirstOwner } from "../../src/scripts/create-owner"
import {
  anyStatus,
  bearer,
  enrolTotp,
  registerLogin,
  signInWithCode,
  tokenOf,
} from "../helpers/staff"
import type { HttpClient } from "../helpers/staff"

jest.setTimeout(180 * 1000)

const tokenOfLink = (link: string) =>
  new URLSearchParams(link.split("#")[1] ?? "").get("token") ?? ""

/**
 * adr/0061 §3.5 (C4): the first owner bootstrapped, invited in, kept to
 * their own 2FA setup until it is passed, then let in. Medusa's own 2FA
 * setup routes stay closed: setup goes through /admin/cp/me/mfa.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient

    it("takes the first owner from invitation to access, 2FA first (KK)", async () => {
      const email = `owner-${randomUUID()}@quant.test`
      // Throwaway credential for this test database only
      const password = randomUUID()
      const { link, mailed } = await inviteFirstOwner(getContainer(), email)
      const token = tokenOfLink(link)

      const info = await http.post("/admin/cp/invites/info", { token }, anyStatus)
      const login = await registerLogin(http, email, password)
      const accepted = await http.post(
        "/admin/cp/invites/accept",
        { token, first_name: "Deniz", last_name: "Kaya" },
        { ...anyStatus, headers: bearer(login) }
      )
      const first = tokenOf(await http.post("/auth/user/emailpass", { email, password }))
      const blocked = await http.get("/admin/cp/staff", { ...anyStatus, headers: bearer(first) })
      const me = await http.get<{ me: { role: string; mfa: Record<string, boolean> } }>(
        "/admin/cp/me",
        { ...anyStatus, headers: bearer(first) }
      )
      const used = new Set<string>()
      const { secret, recoveryCodes } = await enrolTotp(http, first, password, used)
      // The session that set it up has not passed it: a sign-in with the code does
      const stillBlocked = await http.get("/admin/cp/staff", {
        ...anyStatus,
        headers: bearer(first),
      })
      const passed = await signInWithCode(http, { email, password, secret, used })
      const reached = await http.get("/admin/cp/staff", { ...anyStatus, headers: bearer(passed) })
      const meAfter = await http.get<{ me: { mfa: Record<string, boolean> } }>("/admin/cp/me", {
        ...anyStatus,
        headers: bearer(passed),
      })

      expect(mailed).toBe(false)
      expect(link).toMatch(/^http:\/\/localhost:5174\/invite#token=/)
      expect(info.data).toEqual({ email, role: "owner" })
      expect(accepted.status).toBe(201)
      expect(blocked.status).toBe(403)
      expect(blocked.data).toMatchObject({ message: "cp.mfa_required" })
      expect(me.status).toBe(200)
      expect(me.data.me).toMatchObject({ role: "owner", mfa: { enabled: false, passed: false } })
      expect(recoveryCodes.length).toBeGreaterThan(0)
      expect(stillBlocked.status).toBe(403)
      expect(reached.status).toBe(200)
      expect(meAfter.data.me.mfa).toEqual({ required: true, enabled: true, passed: true })

      const [entries] = await getContainer()
        .resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
        .listAndCountCpAuditEntries({}, { take: 100 })
      const actions = entries.map((entry) => `${entry.action} ${String(entry.outcome)}`)
      expect(actions).toEqual(
        expect.arrayContaining([
          "cp_staff.owner_invited null",
          "POST /admin/cp/invites/accept 201",
          "POST /admin/cp/me/mfa/verify 200",
          "GET /admin/cp/staff 200",
        ])
      )
      // Field names only: no code, no password, no token in a row
      const verify = entries.find((entry) => entry.action === "POST /admin/cp/me/mfa/verify")
      expect(verify?.changes).toEqual({ fields: ["code", "password"] })
      expect(JSON.stringify(entries)).not.toContain(password)
      expect(JSON.stringify(entries)).not.toContain(token)

      // Bootstrapped once: with an owner, owners are made from the team
      await expect(
        inviteFirstOwner(getContainer(), `second-${randomUUID()}@quant.test`)
      ).rejects.toThrow("an owner exists")
    })

    it("refuses an address that is not one", async () => {
      await expect(inviteFirstOwner(getContainer(), "not-an-address")).rejects.toThrow(
        "email= must be an e-mail address"
      )
    })

    it("refuses a token that is no invitation", async () => {
      const owner = `other-${randomUUID()}@quant.test`
      const bad = await http.post("/admin/cp/invites/info", { token: "x".repeat(40) }, anyStatus)
      const login = await registerLogin(http, owner, randomUUID())
      const accepted = await http.post(
        "/admin/cp/invites/accept",
        { token: "x".repeat(40), first_name: "A", last_name: "B" },
        { ...anyStatus, headers: bearer(login) }
      )

      expect(bad.status).toBe(400)
      expect(bad.data).toMatchObject({ message: "cp.invite_invalid" })
      expect(accepted.status).toBe(400)
    })

    it("refuses a login without a user anywhere under /admin/cp", async () => {
      const email = `lone-${randomUUID()}@quant.test`
      const password = randomUUID()
      const login = await registerLogin(http, email, password)
      // A login with no user is no staff member: nothing under /admin/cp
      const noUser = await http.post(
        "/admin/cp/me/mfa",
        {},
        { ...anyStatus, headers: bearer(login) }
      )

      expect(noUser.status).toBe(401)
    })

    it.each([
      ["POST", "/auth/mfa/factors"],
      ["POST", "/auth/mfa/factors/authmfa_01/verify"],
      ["POST", "/auth/mfa/recovery-codes"],
    ])("keeps Medusa's own %s %s closed: 404", async (_method, path) => {
      const response = await http.post(path, { provider: "totp" }, anyStatus)

      expect(response.status).toBe(404)
    })
  },
})
