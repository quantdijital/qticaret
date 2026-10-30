import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { setUpTotp } from "../helpers/mfa"

jest.setTimeout(120 * 1000)

interface Made {
  invite: { id: string; email: string; role: string; expired: boolean }
  link: string
}

interface Team {
  staff: { id: string; email: string; role: string | null; you: boolean; mfa: boolean }[]
  invites: { id: string; email: string; role: string }[] | null
}

const tokenOf = (link: string) => new URL(link).searchParams.get("token") ?? ""

/** F12.6 (adr/0040 §4): the team, invited with a role and taken off again. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    const MAIL_ENV = ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]

    const call = (headers: Record<string, string>) => ({
      get: <T>(url: string) => settle(http.get<T>(url, { headers })),
      post: <T>(url: string, body: unknown = {}) => settle(http.post<T>(url, body, { headers })),
      delete: <T>(url: string) => settle(http.delete<T>(url, { headers })),
    })
    const anyone = call({})

    /** What the invitation page does: a login for the address, then the invitation accepted. */
    async function accept(link: string, email: string) {
      // Throwaway credential for this test database only
      const password = randomUUID()
      const registered = await http.post<{ token: string }>("/auth/user/emailpass/register", {
        email,
        password,
      })
      const accepted = await call({ authorization: `Bearer ${registered.data.token}` }).post<{
        member: { id: string; role: string }
        message?: string
      }>("/admin/staff/invites/accept", {
        token: tokenOf(link),
        first_name: "Elif",
        last_name: "Kaya",
      })
      const login = await settle(
        http.post<{ token: string }>("/auth/user/emailpass", { email, password })
      )
      return { accepted, headers: { authorization: `Bearer ${login.data.token}` } }
    }

    beforeAll(async () => {
      fake = await startFakeMail()
      Object.assign(process.env, {
        EMAIL_TRANSPORT: "resend",
        RESEND_API_KEY: fake.apiKey,
        RESEND_BASE_URL: fake.url,
        EMAIL_FROM: "bildirim@platform.example",
      })
    })

    afterAll(async () => {
      for (const name of MAIL_ENV) {
        Reflect.deleteProperty(process.env, name)
      }
      await fake.close()
    })

    it("invites with a role, by e-mail and by link, and the new member has that role", async () => {
      const owner = call((await createAdminUser(http, getContainer())).headers)
      const email = `elif.kaya.${randomUUID().slice(0, 8)}@example.com`

      const made = await owner.post<Made>("/admin/staff/invites", { email, role: "operations" })
      const again = await owner.post<{ message: string }>("/admin/staff/invites", {
        email,
        role: "admin",
      })
      const info = await anyone.get<{ email: string; role: string }>(
        `/admin/staff/invites/info?token=${tokenOf(made.data.link)}`
      )
      const mail = await eventually(
        () => Promise.resolve(fake.messages.find(({ to }) => to.includes(email))),
        (found) => found !== undefined
      )
      const { accepted, headers } = await accept(made.data.link, email)
      const me = await call(headers).get<{ role: string }>("/admin/staff/me")
      const settings = await call(headers).post("/admin/platform-settings/store", {
        timezone: "Europe/Istanbul",
      })
      const used = await anyone.get(`/admin/staff/invites/info?token=${tokenOf(made.data.link)}`)

      expect(made.status).toBe(201)
      expect(made.data.invite).toMatchObject({ email, role: "operations", expired: false })
      expect(made.data).not.toHaveProperty("invite.token")
      expect(made.data.link).toMatch(/\/invite\?token=/)
      expect(again.data.message).toBe("staff.invite_pending")
      expect(info.data).toEqual({ email, role: "operations" })
      expect(mail?.template).toBe("staff_invite")
      expect(mail?.html).toContain(tokenOf(made.data.link))
      expect(accepted.status).toBe(201)
      expect(accepted.data.member.role).toBe("operations")
      expect(me.data.role).toBe("operations")
      expect(settings.status).toBe(403)
      // Accepted: the invitation is gone, its link with it
      expect(used.status).toBe(400)
    })

    it("lets no one else take an invitation: another address's login is refused", async () => {
      const owner = call((await createAdminUser(http, getContainer())).headers)
      const email = `davetli.${randomUUID().slice(0, 8)}@example.com`
      const made = await owner.post<Made>("/admin/staff/invites", { email, role: "admin" })

      const { accepted } = await accept(made.data.link, `baskasi.${randomUUID()}@example.com`)

      expect(accepted.status).toBe(400)
      expect(accepted.data.message).toBe("staff.invite_login")
    })

    it("keeps the team the owner's to change, and the last owner in place", async () => {
      const ownerUser = await createAdminUser(http, getContainer())
      const owner = call(ownerUser.headers)
      const adminUser = await createAdminUser(http, getContainer(), "admin")
      const admin = call(adminUser.headers)
      const opsUser = await createAdminUser(http, getContainer(), "operations")

      const asOwner = await owner.get<Team>("/admin/staff")
      const asAdmin = await admin.get<Team>("/admin/staff")
      const asOps = await call(opsUser.headers).get("/admin/staff")
      const adminChanges = await admin.post(`/admin/staff/members/${opsUser.userId}`, {
        role: "admin",
      })
      const adminInvites = await admin.post("/admin/staff/invites", {
        email: "x@example.com",
        role: "readonly",
      })
      const promoted = await owner.post(`/admin/staff/members/${opsUser.userId}`, {
        role: "admin",
      })
      const lastOwner = await owner.post<{ message: string }>(
        `/admin/staff/members/${ownerUser.userId}`,
        { role: "admin" }
      )
      const inviteMember = await owner.post<{ message: string }>("/admin/staff/invites", {
        email: asOwner.data.staff.find((row) => row.id === adminUser.userId)?.email ?? "",
        role: "readonly",
      })

      expect(asOwner.data.staff.map(({ role, you }) => ({ role, you }))).toEqual([
        { role: "owner", you: true },
        { role: "admin", you: false },
        { role: "operations", you: false },
      ])
      expect(asOwner.data.invites).toEqual([])
      expect(asAdmin.data.invites).toBeNull()
      expect(asOps.status).toBe(403)
      expect([adminChanges.status, adminInvites.status]).toEqual([403, 403])
      expect(promoted.status).toBe(200)
      expect(lastOwner.status).toBe(400)
      expect(lastOwner.data.message).toBe("staff.last_owner")
      expect(inviteMember.data.message).toBe("staff.invite_member")
    })

    it("takes a member off: their open session reaches nothing at once", async () => {
      const ownerUser = await createAdminUser(http, getContainer())
      const owner = call(ownerUser.headers)
      const leaver = await createAdminUser(http, getContainer(), "admin")
      const before = await call(leaver.headers).get("/admin/orders?limit=1")

      const removed = await owner.delete(`/admin/staff/members/${leaver.userId}`)
      const after = await call(leaver.headers).get<{ message: string }>("/admin/orders?limit=1")
      const self = await owner.delete<{ message: string }>(
        `/admin/staff/members/${ownerUser.userId}`
      )

      expect(before.status).toBe(200)
      expect(removed.status).toBe(200)
      expect(after.status).toBe(403)
      expect(after.data.message).toBe("staff.no_role")
      expect(self.data.message).toBe("staff.remove_self")
    })

    it("lets the owner turn off a member's 2FA, their phone lost", async () => {
      const owner = call((await createAdminUser(http, getContainer())).headers)
      const admin = call((await createAdminUser(http, getContainer(), "admin")).headers)
      const member = await createAdminUser(http, getContainer(), "operations")
      await setUpTotp(http, member)
      const mfaOf = async () =>
        (await owner.get<Team>("/admin/staff")).data.staff.find((row) => row.id === member.userId)
          ?.mfa

      const before = await mfaOf()
      const byAdmin = await admin.post(`/admin/staff/members/${member.userId}/reset-mfa`)
      const reset = await owner.post<{ factors: number }>(
        `/admin/staff/members/${member.userId}/reset-mfa`
      )
      const after = await mfaOf()
      const login = await http.post<{ mfa_challenge?: unknown }>("/auth/user/emailpass", {
        email: member.email,
        password: member.password,
      })
      const self = await owner.post<{ message: string }>(
        `/admin/staff/members/${(await owner.get<Team>("/admin/staff")).data.staff.find((row) => row.you)?.id ?? ""}/reset-mfa`
      )

      expect(before).toBe(true)
      expect(byAdmin.status).toBe(403)
      expect(reset.data.factors).toBe(1)
      expect(after).toBe(false)
      expect(login.data.mfa_challenge).toBeUndefined()
      expect(self.data.message).toBe("staff.reset_self")
    })

    it("sends a staff member a reset link to the panel, and the new password works", async () => {
      const member = await createAdminUser(http, getContainer(), "admin")
      const password = randomUUID()

      const asked = await anyone.post("/auth/user/emailpass/reset-password", {
        identifier: member.email,
      })
      const mail = await eventually(
        () =>
          Promise.resolve(
            fake.messages.find(
              ({ to, template }) => to.includes(member.email) && template === "staff_password_reset"
            )
          ),
        (found) => found !== undefined
      )
      const link = /href="([^"]*\/reset-password\?[^"]*)"/.exec(mail?.html ?? "")?.[1] ?? ""
      const resetToken = new URL(link.replace(/&amp;/g, "&")).searchParams.get("token") ?? ""
      const changed = await call({ authorization: `Bearer ${resetToken}` }).post(
        "/auth/user/emailpass/update",
        { password }
      )
      const oldPassword = await settle(
        http.post("/auth/user/emailpass", { email: member.email, password: member.password })
      )
      const newPassword = await settle(
        http.post("/auth/user/emailpass", { email: member.email, password })
      )

      expect(asked.status).toBeLessThan(300)
      expect(link).toContain("/reset-password?")
      expect(changed.status).toBe(200)
      expect(oldPassword.status).toBe(401)
      expect(newPassword.status).toBe(200)
    })

    it("sends an invitation again with a new link, and withdraws one", async () => {
      const owner = call((await createAdminUser(http, getContainer())).headers)
      const made = await owner.post<Made>("/admin/staff/invites", {
        email: `tekrar.${randomUUID().slice(0, 8)}@example.com`,
        role: "readonly",
      })

      const resent = await owner.post<Made>(`/admin/staff/invites/${made.data.invite.id}/resend`)
      const oldLink = await anyone.get(`/admin/staff/invites/info?token=${tokenOf(made.data.link)}`)
      const newLink = await anyone.get(
        `/admin/staff/invites/info?token=${tokenOf(resent.data.link)}`
      )
      const withdrawn = await owner.delete(`/admin/staff/invites/${made.data.invite.id}`)
      const afterWithdrawal = await anyone.get(
        `/admin/staff/invites/info?token=${tokenOf(resent.data.link)}`
      )

      expect(resent.status).toBe(200)
      expect(resent.data.link).not.toBe(made.data.link)
      expect([oldLink.status, newLink.status]).toEqual([400, 200])
      expect(withdrawn.status).toBe(200)
      expect(afterWithdrawal.status).toBe(400)
    })
  },
})
