import { randomUUID } from "node:crypto"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  anyStatus,
  bearer,
  makeMember,
  registerLogin,
  serverLogin,
  signInWithRecoveryCode,
  stepUp,
  tokenOf,
  tokenOfLink,
} from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"

jest.setTimeout(180 * 1000)

/**
 * adr/0061 §3.5 (C4): each role reaches what the route table gives it;
 * the staff are the owner's, every grant behind a step-up; a deactivated
 * member reaches nothing; every mutation leaves an audit row.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member
    let operator: Member
    let finance: Member
    let readonly: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
      operator = await makeMember(http, getContainer(), "operator")
      finance = await makeMember(http, getContainer(), "finance")
      readonly = await makeMember(http, getContainer(), "readonly")
    })

    const get = (path: string, member: Member) =>
      http.get(path, { ...anyStatus, headers: member.headers })

    it.each([
      ["owner", 200],
      ["operator", 403],
      ["finance", 403],
      ["readonly", 403],
    ] as const)(
      "gives the staff list and the audit log to the owner: %s gets %i",
      async (role, status) => {
        const member = { owner, operator, finance, readonly }[role]
        const staff = await get("/admin/cp/staff", member)
        const audit = await get("/admin/cp/audit-log", member)

        expect(staff.status).toBe(status)
        expect(audit.status).toBe(status)
        if (status === 403) {
          expect(staff.data).toMatchObject({ message: "cp.forbidden" })
        }
      }
    )

    it.each(["owner", "operator", "finance", "readonly"] as const)(
      "lets %s read its own account and sessions",
      async (role) => {
        const member = { owner, operator, finance, readonly }[role]

        expect((await get("/admin/cp/me", member)).status).toBe(200)
        expect((await get("/admin/cp/me/sessions", member)).status).toBe(200)
      }
    )

    it("takes a secret API key for no staff member", async () => {
      const [key] = await getContainer()
        .resolve(Modules.API_KEY)
        .createApiKeys([{ title: "otomasyon", type: "secret", created_by: owner.userId }])
      const basic = Buffer.from(`${key?.token ?? ""}:`).toString("base64")
      const response = await http.get("/admin/cp/me", {
        ...anyStatus,
        headers: { authorization: `Basic ${basic}` },
      })

      expect(response.status).toBe(401)
      expect(response.data).toMatchObject({ message: "cp.not_staff" })
    })

    it("answers 404 to a route the table does not list, whatever the role", async () => {
      const response = await get("/admin/cp/tenants", owner)

      expect(response.status).toBe(404)
    })

    it("asks a step-up for an invitation, and takes it from no one else", async () => {
      const body = { email: `op-${randomUUID()}@quant.test`, role: "operator" }
      const invite = (headers: Record<string, string>) =>
        http.post("/admin/cp/staff/invites", body, { ...anyStatus, headers })

      const without = await invite(owner.headers)
      const forged = await invite({ ...owner.headers, "x-cp-step-up": "A".repeat(80) })
      // Another member's proof is no proof of the owner
      const borrowed = await invite({
        ...owner.headers,
        "x-cp-step-up": (await stepUp(http, readonly))["x-cp-step-up"] ?? "",
      })
      const wrongCode = await http.post(
        "/admin/cp/me/step-up",
        { method: "totp", code: "000000" },
        { ...anyStatus, headers: owner.headers }
      )
      const byOperator = await invite(await stepUp(http, operator))
      const proved = await invite(await stepUp(http, owner))

      expect(without.status).toBe(428)
      expect(without.data).toMatchObject({ message: "cp.step_up_required" })
      expect(forged.status).toBe(428)
      expect(forged.data).toMatchObject({ message: "cp.step_up_invalid" })
      expect(borrowed.status).toBe(428)
      expect(wrongCode.status).toBe(403)
      expect(wrongCode.data).toMatchObject({ message: "cp.step_up_failed" })
      expect(byOperator.status).toBe(403)
      expect(proved.status).toBe(201)
      expect(proved.data).toMatchObject({ invite: { email: body.email, role: "operator" } })
      expect(JSON.stringify(proved.data["invite"])).not.toContain("token")
    })

    it("lets a link carry its invitation to the invited address only, then to 2FA", async () => {
      const email = `fin-${randomUUID()}@quant.test`
      const invited = await http.post<{ link: string }>(
        "/admin/cp/staff/invites",
        { email, role: "finance" },
        { ...anyStatus, headers: await stepUp(http, owner) }
      )
      const token = tokenOfLink(invited.data.link)
      // A login for another address, made elsewhere: the API would not make it (L1)
      const strangerEmail = `x-${randomUUID()}@quant.test`
      await serverLogin(getContainer(), strangerEmail, "stranger-password")
      const stranger = tokenOf(
        await http.post("/auth/user/emailpass", {
          email: strangerEmail,
          password: "stranger-password",
        })
      )
      const wrongLogin = await http.post(
        "/admin/cp/invites/accept",
        { token, first_name: "Ayşe", last_name: "Yıldız" },
        { ...anyStatus, headers: bearer(stranger) }
      )
      const password = randomUUID()
      const own = await registerLogin(http, email, password, token)
      const accepted = await http.post<{ member: { role: string } }>(
        "/admin/cp/invites/accept",
        { token, first_name: "Ayşe", last_name: "Yıldız" },
        { ...anyStatus, headers: bearer(own) }
      )
      // Pending until 2FA (M3): the role is not granted yet
      const signedIn = tokenOf(await http.post("/auth/user/emailpass", { email, password }))
      const before = await http.get("/admin/cp/me/sessions", {
        ...anyStatus,
        headers: bearer(signedIn),
      })

      expect(wrongLogin.status).toBe(400)
      expect(wrongLogin.data).toMatchObject({ message: "cp.invite_login" })
      expect(accepted.status).toBe(201)
      expect(accepted.data.member.role).toBe("finance")
      expect(before.status).toBe(403)
      expect(before.data).toMatchObject({ message: "cp.mfa_required" })
    })

    it("never takes the last owner's role, and takes it once there is another", async () => {
      const demote = (headers: Record<string, string>, id: string, role: string) =>
        http.post(`/admin/cp/staff/members/${id}`, { role }, { ...anyStatus, headers })

      // One proof holds for five minutes: several changes in a row ask it once
      const proved = await stepUp(http, owner)
      const last = await demote(proved, owner.userId, "readonly")
      const promoted = await demote(proved, finance.userId, "owner")
      const financeNow = await get("/admin/cp/staff", finance)
      const back = await demote(proved, finance.userId, "finance")

      expect(last.status).toBe(400)
      expect(last.data).toMatchObject({ message: "cp.last_owner" })
      expect(promoted.status).toBe(200)
      expect(financeNow.status).toBe(200)
      expect(back.status).toBe(200)
      expect((await get("/admin/cp/staff", finance)).status).toBe(403)
    })

    it("shuts a deactivated member out at once; reactivation revives nothing old (M1)", async () => {
      const old = readonly.headers
      const proved = await stepUp(http, owner)
      const deactivate = await http.post(
        `/admin/cp/staff/members/${readonly.userId}/deactivate`,
        {},
        { ...anyStatus, headers: proved }
      )
      const oldAfter = await http.get("/admin/cp/me/sessions", { ...anyStatus, headers: old })
      const fresh = bearer(await signInWithRecoveryCode(http, readonly))
      const freshAfter = await http.get("/admin/cp/me/sessions", { ...anyStatus, headers: fresh })
      const self = await http.post(
        `/admin/cp/staff/members/${owner.userId}/deactivate`,
        {},
        { ...anyStatus, headers: proved }
      )
      const reactivate = await http.post(
        `/admin/cp/staff/members/${readonly.userId}/reactivate`,
        {},
        { ...anyStatus, headers: proved }
      )
      const revived = await http.get("/admin/cp/me/sessions", { ...anyStatus, headers: fresh })
      readonly.headers = bearer(await signInWithRecoveryCode(http, readonly))

      expect(deactivate.status).toBe(200)
      expect(oldAfter.status).toBe(401)
      expect(oldAfter.data).toMatchObject({ message: "cp.session_revoked" })
      expect(freshAfter.status).toBe(403)
      expect(freshAfter.data).toMatchObject({ message: "cp.no_role" })
      expect(self.status).toBe(400)
      expect(reactivate.status).toBe(200)
      // Its sign-in and token are from before: refused, one way or the other
      expect([401, 403]).toContain(revived.status)
      expect((await get("/admin/cp/me/sessions", readonly)).status).toBe(200)
    })

    it("refuses an operator's invitation before reading its body (guard first)", async () => {
      const response = await http.post(
        "/admin/cp/staff/invites",
        { email: "not-an-address", role: "emperor", extra: true },
        { ...anyStatus, headers: operator.headers }
      )

      expect(response.status).toBe(403)
      expect(response.data).toMatchObject({ message: "cp.forbidden" })
    })
  },
})
