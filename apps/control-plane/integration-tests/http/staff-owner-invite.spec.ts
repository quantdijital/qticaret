import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { CP_AUDIT_MODULE } from "../../src/modules/cp-audit"
import type CpAuditModuleService from "../../src/modules/cp-audit/service"
import {
  anyStatus,
  bearer,
  enrolTotp,
  makeMember,
  registerLogin,
  serverLogin,
  signInWithCode,
  stepUp,
  tokenOf,
  tokenOfLink,
} from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(180 * 1000)

interface Invited {
  invite: { email: string; role: string }
  link: string
  mailed: boolean
}

/**
 * adr/0061 §3.5 (2026-11-12): an owner invites another owner from the
 * staff page, behind the same step-up and audit as any invitation. The
 * invited owner is pending until their 2FA (no owner until then, the last
 * owner's guard included); the invitation holds only while its inviter is
 * still a granted owner.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member
    let operator: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
    })

    const invite = (headers: Record<string, string>, email: string, role = "owner") =>
      http.post<Invited>("/admin/cp/staff/invites", { email, role }, { ...anyStatus, headers })

    const changeRole = (headers: Record<string, string>, id: string, role: string) =>
      http.post(`/admin/cp/staff/members/${id}`, { role }, { ...anyStatus, headers })

    it("lets an owner invite an owner behind the step-up, and no one else", async () => {
      const email = `owner2-${randomUUID()}@quant.test`
      const byOperator = await invite(await stepUp(http, operator), email)
      const without = await invite(owner.headers, email)
      const flagged = await http.post(
        "/admin/cp/staff/invites",
        { email, role: "owner", bootstrap: true },
        { ...anyStatus, headers: await stepUp(http, owner) }
      )
      const proved = await invite(await stepUp(http, owner), email)
      // The row is written once the answer has gone
      await new Promise((resolve) => setTimeout(resolve, 200))
      const [rows] = await getContainer()
        .resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
        .listAndCountCpAuditEntries(
          { action: "POST /admin/cp/staff/invites", actor_id: owner.userId },
          { take: 10 }
        )

      expect(byOperator.status).toBe(403)
      expect(byOperator.data).toMatchObject({ message: "cp.forbidden" })
      expect(without.status).toBe(428)
      expect(without.data).toMatchObject({ message: "cp.step_up_required" })
      // Only `cp:create-owner` makes a bootstrap invitation
      expect(flagged.status).toBe(400)
      expect(proved.status).toBe(201)
      expect(proved.headers["cache-control"]).toBe("no-store")
      expect(proved.data).toMatchObject({ invite: { email, role: "owner" }, mailed: false })
      expect(proved.data.link).toMatch(/^http:\/\/localhost:5174\/invite#token=/)
      expect(JSON.stringify(proved.data.invite)).not.toContain("token")
      expect(rows.find((row) => row.outcome === 201)).toMatchObject({
        resource_type: "cp_invite",
        changes: { fields: ["email", "role"] },
      })
      expect(JSON.stringify(rows)).not.toContain(email)
    })

    it("keeps the invited owner pending until 2FA, then grants the role", async () => {
      const email = `owner3-${randomUUID()}@quant.test`
      // Throwaway credential for this test database only
      const password = randomUUID()
      const invited = await invite(await stepUp(http, owner), email)
      const token = tokenOfLink(invited.data.link)
      const info = await http.post("/admin/cp/invites/info", { token }, anyStatus)
      const login = await registerLogin(http, email, password, token)
      const accepted = await http.post<{ member: { id: string; role: string } }>(
        "/admin/cp/invites/accept",
        { token, first_name: "Elif", last_name: "Demir" },
        { ...anyStatus, headers: bearer(login) }
      )
      const first = tokenOf(await http.post("/auth/user/emailpass", { email, password }))
      const blocked = await http.get("/admin/cp/staff", { ...anyStatus, headers: bearer(first) })
      const me = await http.get<{ me: Record<string, unknown> }>("/admin/cp/me", {
        ...anyStatus,
        headers: bearer(first),
      })
      // Pending is no owner: the inviter is still the last one
      const proved = await stepUp(http, owner)
      const lastStill = await changeRole(proved, owner.userId, "readonly")
      const used = new Set<string>()
      const { secret } = await enrolTotp(http, first, password, used)
      const passed = bearer(await signInWithCode(http, { email, password, secret, used }))
      const reached = await http.get("/admin/cp/staff", { ...anyStatus, headers: passed })
      const meAfter = await http.get<{ me: { pending: boolean; role: string } }>("/admin/cp/me", {
        ...anyStatus,
        headers: passed,
      })
      // Granted: the control plane now has another owner, so the first may step down
      const stepDown = await changeRole(proved, owner.userId, "readonly")

      expect(info.data).toEqual({ email, role: "owner" })
      expect(accepted.status).toBe(201)
      expect(accepted.data.member.role).toBe("owner")
      expect(blocked.status).toBe(403)
      expect(blocked.data).toMatchObject({ message: "cp.mfa_required" })
      expect(me.data.me).toMatchObject({ role: "owner", pending: true })
      expect(lastStill.status).toBe(400)
      expect(lastStill.data).toMatchObject({ message: "cp.last_owner" })
      expect(reached.status).toBe(200)
      expect(meAfter.data.me).toMatchObject({ role: "owner", pending: false })
      expect(stepDown.status).toBe(200)
    })

    it("refuses an owner's invitation once its inviter is no owner, other roles' not", async () => {
      const second = await makeMember(http, getContainer(), "owner")
      const email = `owner4-${randomUUID()}@quant.test`
      const financeEmail = `fin-${randomUUID()}@quant.test`
      const bySecond = await stepUp(http, second)
      const ownerToken = tokenOfLink((await invite(bySecond, email)).data.link)
      const financeToken = tokenOfLink((await invite(bySecond, financeEmail, "finance")).data.link)
      const demoted = await changeRole(await stepUp(http, owner), second.userId, "operator")

      const info = await http.post("/admin/cp/invites/info", { token: ownerToken }, anyStatus)
      const register = await http.post(
        "/auth/user/emailpass/register",
        { email, password: "mavi kuş sabah uçar" },
        { ...anyStatus, headers: { "x-cp-invite": ownerToken } }
      )
      // A login made elsewhere for the address: the invitation still makes no owner
      const password = randomUUID()
      await serverLogin(getContainer(), email, password)
      const login = tokenOf(await http.post("/auth/user/emailpass", { email, password }))
      const accepted = await http.post(
        "/admin/cp/invites/accept",
        { token: ownerToken, first_name: "A", last_name: "B" },
        { ...anyStatus, headers: bearer(login) }
      )
      const financeInfo = await http.post(
        "/admin/cp/invites/info",
        { token: financeToken },
        anyStatus
      )

      expect(demoted.status).toBe(200)
      expect(info.status).toBe(400)
      expect(info.data).toMatchObject({ message: "cp.invite_invalid" })
      expect(register.status).toBe(403)
      expect(register.data).toMatchObject({ message: "cp.register_closed" })
      expect(accepted.status).toBe(400)
      expect(accepted.data).toMatchObject({ message: "cp.invite_invalid" })
      expect(financeInfo.data).toEqual({ email: financeEmail, role: "finance" })
    })
  },
})
