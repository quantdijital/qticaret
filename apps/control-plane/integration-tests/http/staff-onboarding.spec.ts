import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CP_AUDIT_MODULE } from "../../src/modules/cp-audit"
import type CpAuditModuleService from "../../src/modules/cp-audit/service"
import { inviteFirstOwner } from "../../src/scripts/create-owner"
import {
  anyStatus,
  bearer,
  enrolTotp,
  registerLogin,
  serverLogin,
  signInWithCode,
  tokenOf,
  tokenOfLink,
} from "../helpers/staff"
import type { HttpClient } from "../helpers/staff"

jest.setTimeout(180 * 1000)

const auditRows = async (container: MedusaContainer) => {
  // The rows are written once the answer has gone
  await new Promise((resolve) => setTimeout(resolve, 200))
  const [entries] = await container
    .resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
    .listAndCountCpAuditEntries({}, { take: 200 })
  return entries
}

/**
 * adr/0061 §3.5 (C4, Ek C4): the first owner bootstrapped, invited in,
 * pending until their first factor is confirmed, then let in. A login is
 * made only with an invitation; Medusa's own 2FA setup, reset and token
 * refresh routes stay closed.
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
      const login = await registerLogin(http, email, password, token)
      const accepted = await http.post(
        "/admin/cp/invites/accept",
        { token, first_name: "Deniz", last_name: "Kaya" },
        { ...anyStatus, headers: bearer(login) }
      )
      // Pending: no owner is granted yet, so the bootstrap is not closed yet either
      const pendingOwner = await getContainer()
        .resolve(Modules.USER)
        .listUsers({ email }, { select: ["id"], take: 1 })
      const first = tokenOf(await http.post("/auth/user/emailpass", { email, password }))
      const blocked = await http.get("/admin/cp/staff", { ...anyStatus, headers: bearer(first) })
      const me = await http.get<{ me: Record<string, unknown> }>("/admin/cp/me", {
        ...anyStatus,
        headers: bearer(first),
      })
      const used = new Set<string>()
      const { secret, recoveryCodes } = await enrolTotp(http, first, password, used)
      // The token that set it up has not passed it: a sign-in with the code does
      const stillBlocked = await http.get("/admin/cp/staff", {
        ...anyStatus,
        headers: bearer(first),
      })
      const passed = await signInWithCode(http, { email, password, secret, used })
      const reached = await http.get("/admin/cp/staff", { ...anyStatus, headers: bearer(passed) })
      const meAfter = await http.get<{ me: { pending: boolean; mfa: Record<string, boolean> } }>(
        "/admin/cp/me",
        { ...anyStatus, headers: bearer(passed) }
      )

      expect(mailed).toBe(false)
      expect(link).toMatch(/^http:\/\/localhost:5174\/invite#token=/)
      expect(info.data).toEqual({ email, role: "owner" })
      expect(accepted.status).toBe(201)
      expect(pendingOwner).toHaveLength(1)
      expect(blocked.status).toBe(403)
      expect(blocked.data).toMatchObject({ message: "cp.mfa_required" })
      expect(me.status).toBe(200)
      expect(me.data.me).toMatchObject({
        role: "owner",
        pending: true,
        mfa: { enabled: false, passed: false },
      })
      expect(recoveryCodes.length).toBeGreaterThan(0)
      expect(stillBlocked.status).toBe(403)
      expect(reached.status).toBe(200)
      expect(meAfter.data.me.pending).toBe(false)
      expect(meAfter.data.me.mfa).toEqual({ required: true, enabled: true, passed: true })

      const entries = await auditRows(getContainer())
      const actions = entries.map((entry) => `${entry.action} ${String(entry.outcome)}`)
      expect(actions).toEqual(
        expect.arrayContaining([
          "cp_staff.owner_invited null",
          "cp.auth.register 200",
          "POST /admin/cp/invites/accept 201",
          "cp.auth.sign_in 200",
          "cp.auth.second_step 200",
          "POST /admin/cp/me/mfa/verify 200",
          "GET /admin/cp/staff 200",
        ])
      )
      // Field names only: no code, no password, no token, no address in a row
      const verify = entries.find((entry) => entry.action === "POST /admin/cp/me/mfa/verify")
      expect(verify?.changes).toEqual({ fields: ["code", "password"] })
      const second = entries.find((entry) => entry.action === "cp.auth.second_step")
      // Who it was, from the challenge (or the password step's token): never unnamed
      expect(second?.actor_id).toEqual(expect.any(String))
      for (const secretValue of [password, token, email]) {
        expect(JSON.stringify(entries)).not.toContain(secretValue)
      }

      // Bootstrapped once: with an owner, owners are made from the team
      await expect(
        inviteFirstOwner(getContainer(), `second-${randomUUID()}@quant.test`)
      ).rejects.toThrow("an owner exists")
    })

    it("keeps no execution of the acceptance, which carries the invitation's token", async () => {
      const email = `wf-${randomUUID()}@quant.test`
      const { link } = await inviteFirstOwner(getContainer(), email)
      const token = tokenOfLink(link)
      const login = await registerLogin(http, email, randomUUID(), token)
      const accepted = await http.post(
        "/admin/cp/invites/accept",
        { token, first_name: "A", last_name: "B" },
        { ...anyStatus, headers: bearer(login) }
      )
      const executions = await getContainer()
        .resolve(Modules.WORKFLOW_ENGINE)
        .listWorkflowExecutions({ workflow_id: "cp-staff-accept-invite" })

      expect(accepted.status).toBe(201)
      expect(executions).toHaveLength(0)
    })

    it("withdraws every earlier bootstrap invitation, and keeps one an hour (L2, L3)", async () => {
      const first = await inviteFirstOwner(getContainer(), `a-${randomUUID()}@quant.test`)
      const second = await inviteFirstOwner(getContainer(), `b-${randomUUID()}@quant.test`)
      const oldInfo = await http.post(
        "/admin/cp/invites/info",
        { token: tokenOfLink(first.link) },
        anyStatus
      )
      const newInfo = await http.post(
        "/admin/cp/invites/info",
        { token: tokenOfLink(second.link) },
        anyStatus
      )
      jest.useFakeTimers({ doNotFake: ["nextTick", "setImmediate", "setTimeout"] })
      jest.setSystemTime(Date.now() + 61 * 60 * 1000)
      const late = await http.post(
        "/admin/cp/invites/info",
        { token: tokenOfLink(second.link) },
        anyStatus
      )
      jest.useRealTimers()

      expect(oldInfo.status).toBe(400)
      expect(newInfo.status).toBe(200)
      expect(late.status).toBe(400)
    })

    it("refuses an address that is not one", async () => {
      await expect(inviteFirstOwner(getContainer(), "not-an-address")).rejects.toThrow(
        "email= must be an e-mail address"
      )
    })

    it("makes a login only with an invitation for its own address (L1)", async () => {
      const email = `inv-${randomUUID()}@quant.test`
      const { link } = await inviteFirstOwner(getContainer(), email)
      const token = tokenOfLink(link)
      const register = (body: object, headers: Record<string, string> = {}) =>
        http.post("/auth/user/emailpass/register", body, { ...anyStatus, headers })

      const none = await register({ email, password: randomUUID() })
      const other = await register(
        { email: `x-${randomUUID()}@quant.test`, password: randomUUID() },
        { "x-cp-invite": token }
      )
      // Someone made a login for the address before the invitee: it goes
      const squatter = await serverLogin(getContainer(), email, "squatter-password")
      const own = await register({ email, password: randomUUID() }, { "x-cp-invite": token })
      const squatterIn = await http.post(
        "/auth/user/emailpass",
        { email, password: "squatter-password" },
        anyStatus
      )

      expect(none.status).toBe(403)
      expect(none.data).toMatchObject({ message: "cp.register_closed" })
      expect(other.status).toBe(403)
      expect(squatter).toEqual(expect.any(String))
      expect(own.status).toBe(200)
      expect(squatterIn.status).toBe(401)
    })

    it("holds a new login's password to the shop's rule, the invitation still good (Ek C6)", async () => {
      const email = `ayse.kaya-${randomUUID().slice(0, 8)}@quant.test`
      const { link } = await inviteFirstOwner(getContainer(), email)
      const token = tokenOfLink(link)
      const register = (password: string) =>
        http.post(
          "/auth/user/emailpass/register",
          { email, password },
          { ...anyStatus, headers: { "x-cp-invite": token } }
        )

      const short = await register("kisa-sif")
      const long = await register(`mavi kuş sabah uçar ${"x".repeat(240)}`)
      const common = await register("Galatasaray1905")
      const named = await register(`${email.split("@")[0] ?? ""}-2026!`)
      const logins = await getContainer()
        .resolve(Modules.AUTH)
        .listProviderIdentities({ provider: "emailpass", entity_id: email }, { take: 5 })
      const good = await register("mavi kuş sabah uçar")

      expect(short.status).toBe(400)
      expect(short.data).toMatchObject({ message: "auth.password_too_short" })
      expect(long.data).toMatchObject({ message: "auth.password_too_long" })
      expect(common.data).toMatchObject({ message: "auth.password_common" })
      expect(named.data).toMatchObject({ message: "auth.password_contains_email" })
      // Refused before any login was made
      expect(logins).toHaveLength(0)
      expect(good.status).toBe(200)
    })

    it("refuses a token that is no invitation", async () => {
      const email = `other-${randomUUID()}@quant.test`
      const password = randomUUID()
      await serverLogin(getContainer(), email, password)
      const login = tokenOf(await http.post("/auth/user/emailpass", { email, password }))
      const bad = await http.post("/admin/cp/invites/info", { token: "x".repeat(40) }, anyStatus)
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
      await serverLogin(getContainer(), email, password)
      const token = tokenOf(await http.post("/auth/user/emailpass", { email, password }))
      const noUser = await http.post(
        "/admin/cp/me/mfa",
        {},
        { ...anyStatus, headers: bearer(token) }
      )

      expect(noUser.status).toBe(401)
    })

    it.each([
      "/auth/mfa/factors",
      "/auth/mfa/factors/authmfa_01/verify",
      "/auth/mfa/recovery-codes",
      "/auth/token/refresh",
      "/auth/user/emailpass/reset-password",
      "/auth/user/emailpass/update",
    ])("keeps Medusa's own POST %s closed: 404", async (path) => {
      const response = await http.post(path, { provider: "totp" }, anyStatus)

      expect(response.status).toBe(404)
    })
  },
})
