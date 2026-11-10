import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { parseKey } from "@qticaret/server-kit"
import { EMAIL_CHANGE_TTL_MS, newEmailChange, sealEmailChange } from "../../src/lib/staff/account"
import { createAdminUser } from "../helpers/admin"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { caller, confirmTokenIn, keyOf, useFakeMail } from "../helpers/staff-account"

jest.setTimeout(120 * 1000)

interface Profile {
  profile: { email: string }
  pending_email: { to: string; expires_at: string } | null
}

/**
 * The owner, 2026-11-06; security review 2026-11-06: a member's new sign-in
 * address, confirmed by that member signed in, the latest ask only.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = (headers: Record<string, string>) => caller(http, headers)
    const { mail, mailTo } = useFakeMail()
    const signIn = (email: string, password: string) =>
      settle(http.post("/auth/user/emailpass", { email, password }))
    const confirmMails = (to: string, count: number) =>
      eventually(
        () =>
          Promise.resolve(
            mail().messages.filter(
              (each) => each.to.includes(to) && each.template === "staff_email_confirm"
            )
          ),
        (found) => found.length >= count
      )
    const askFor = (headers: Record<string, string>, email: string, password: string) =>
      call(headers).post("/admin/staff/me/email", { email, current_password: password })

    it("moves the login only when its member confirms the latest link, once", async () => {
      const member = await createAdminUser(http, getContainer(), "operations")
      const stranger = await createAdminUser(http, getContainer(), "owner")
      const me = call(member.plain)
      const first = `ilk-${randomUUID()}@example.com`
      const next = `yeni-${randomUUID()}@example.com`

      const wrong = await me.post("/admin/staff/me/email", {
        email: next,
        current_password: "yanlis-sifre-2026",
      })
      expect(keyOf(wrong.data)).toBe("staff.password_wrong")
      expect((await askFor(member.plain, first, member.password)).status).toBe(202)
      const [older] = await confirmMails(first, 1)
      const asked = await askFor(member.plain, next.toUpperCase(), member.password)
      const pending = await me.get<Profile>("/admin/staff/me/profile")
      const [link] = await mailTo(next, "staff_email_confirm")
      const [notice] = await mailTo(member.email, "staff_account_changed")
      const token = confirmTokenIn(link?.html ?? "")

      const stale = await me.post("/admin/staff/me/email/confirm", {
        token: confirmTokenIn(older?.html ?? ""),
      })
      const signedOut = await call({}).post("/admin/staff/me/email/confirm", { token })
      const byAnother = await call(stranger.plain).post("/admin/staff/me/email/confirm", { token })
      const confirmed = await me.post("/admin/staff/me/email/confirm", { token })
      const again = await me.post("/admin/staff/me/email/confirm", { token })
      const after = await me.get<Profile>("/admin/staff/me/profile")

      expect(asked.status).toBe(202)
      expect(pending.data).toMatchObject({
        profile: { email: member.email },
        pending_email: { to: next },
      })
      expect(notice?.subject).toMatch(/değişikliği istendi$/)
      expect(notice?.html).not.toContain(next)
      expect(keyOf(stale.data)).toBe("staff.email_change_invalid")
      expect(signedOut.status).toBe(401)
      expect(keyOf(byAnother.data)).toBe("staff.email_change_invalid")
      expect(confirmed.status).toBe(200)
      expect(keyOf(again.data)).toBe("staff.email_change_invalid")
      expect(after.data).toMatchObject({ profile: { email: next }, pending_email: null })
      expect((await signIn(next, member.password)).status).toBe(200)
      expect((await signIn(member.email, member.password)).status).toBe(401)
      const told = await eventually(
        () =>
          Promise.resolve(
            mail().messages.filter(
              (each) => each.to.includes(member.email) && each.template === "staff_account_changed"
            )
          ),
        (found) => found.length >= 3
      )
      expect(told.map((each) => each.subject)).toContainEqual(
        expect.stringMatching(/e-posta adresiniz değişti$/)
      )
      // The link's token is in no workflow run
      const runs: { rows: { count: number }[] } = await getContainer()
        .resolve(ContainerRegistrationKeys.PG_CONNECTION)
        .raw(
          "select count(*)::int as count from workflow_execution where execution::text like ? or context::text like ?",
          [`%${token.slice(-40)}%`, `%${token.slice(-40)}%`]
        )
      expect(token.length).toBeGreaterThan(40)
      expect(runs.rows[0]?.count).toBe(0)
    })

    it("drops a waiting change on cancel: its link moves nothing", async () => {
      const member = await createAdminUser(http, getContainer(), "readonly")
      const me = call(member.plain)
      const next = `iptal-${randomUUID()}@example.com`

      await askFor(member.plain, next, member.password)
      const [link] = await mailTo(next, "staff_email_confirm")
      const canceled = await me.post<{ canceled: boolean }>("/admin/staff/me/email/cancel")
      const confirmed = await me.post("/admin/staff/me/email/confirm", {
        token: confirmTokenIn(link?.html ?? ""),
      })

      expect(canceled.data.canceled).toBe(true)
      expect(keyOf(confirmed.data)).toBe("staff.email_change_invalid")
      expect((await me.get<Profile>("/admin/staff/me/profile")).data).toMatchObject({
        profile: { email: member.email },
        pending_email: null,
      })
    })

    it("says who holds an address only at confirmation, to the member, in one word", async () => {
      const member = await createAdminUser(http, getContainer(), "readonly")
      const teammate = await createAdminUser(http, getContainer(), "readonly")
      const customer = `musteri-${randomUUID()}@example.com`
      // A shopper's login under that address (registration alone makes it)
      await http.post("/auth/customer/emailpass/register", {
        email: customer,
        password: randomUUID(),
      })
      const me = call(member.plain)
      const key = parseKey(process.env["PII_ENCRYPTION_KEY"] ?? "", "PII_ENCRYPTION_KEY")
      const expired = sealEmailChange(
        newEmailChange(
          { user_id: member.userId, from: member.email, to: `x-${randomUUID()}@example.com` },
          Date.now() - 2 * EMAIL_CHANGE_TTL_MS
        ),
        key
      )

      const old = await me.post("/admin/staff/me/email/confirm", { token: expired })
      const same = await askFor(member.plain, member.email, member.password)
      const results: string[] = []
      for (const address of [teammate.email, customer]) {
        const asked = await askFor(member.plain, address, member.password)
        const [link] = await mailTo(address, "staff_email_confirm")
        const confirmed = await me.post("/admin/staff/me/email/confirm", {
          token: confirmTokenIn(link?.html ?? ""),
        })
        results.push(`${String(asked.status)} ${keyOf(confirmed.data) ?? ""}`)
      }

      expect(keyOf(old.data)).toBe("staff.email_change_invalid")
      expect(keyOf(same.data)).toBe("staff.email_same")
      expect(results).toEqual(["202 staff.email_unavailable", "202 staff.email_unavailable"])
      expect((await me.get<Profile>("/admin/staff/me/profile")).data.profile.email).toBe(
        member.email
      )
    })

    it("lets a member ask a few changes a day, from any address", async () => {
      const member = await createAdminUser(http, getContainer(), "readonly")
      const statuses: number[] = []
      for (let index = 0; index < 6; index += 1) {
        statuses.push(
          (await askFor(member.plain, `gunluk-${randomUUID()}@example.com`, member.password)).status
        )
      }
      expect(statuses).toEqual([202, 202, 202, 202, 202, 429])
    })
  },
})
