import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { startFakeMail } from "@qticaret/testing"
import type { FakeMail } from "@qticaret/testing"
import { parseKey } from "../../src/lib/crypto/pii"
import { EMAIL_CHANGE_TTL_MS, sealEmailChange } from "../../src/lib/staff/account"
import { createAdminUser } from "../helpers/admin"

import { eventually } from "../helpers/eventually"
import type { HttpClient, HttpResponse } from "../helpers/http"
import { settle } from "../helpers/http"
import { setUpTotp } from "../helpers/mfa"
import { totp } from "../helpers/totp"

jest.setTimeout(120 * 1000)

interface Profile {
  profile: {
    id: string
    email: string
    first_name: string | null
    last_name: string | null
    job_title: string | null
    role: string | null
    created_at: string
  }
  sessions: { open: number | null }
}

interface Answer {
  message?: string
  code?: string
}

function sessionCookie(response: HttpResponse<unknown>): string {
  const header = response.headers["set-cookie"]
  const cookies = Array.isArray(header) ? header : header ? [header] : []
  return (cookies.find((value) => value.startsWith("connect.sid=")) ?? "").split(";")[0] ?? ""
}

// The token after `#`: no access log keeps it
const tokenIn = (html: string) => {
  const link = /href="([^"]*\/confirm-email#[^"]*)"/.exec(html)?.[1] ?? ""
  return new URLSearchParams(new URL(link.replace(/&amp;/g, "&")).hash.slice(1)).get("token") ?? ""
}

/** The owner, 2026-11-06: every staff member sees and changes their own account, nobody else's. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let fake: FakeMail
    const MAIL_ENV = ["EMAIL_TRANSPORT", "RESEND_API_KEY", "RESEND_BASE_URL", "EMAIL_FROM"]
    // A browser sends its origin; CSRF protection (F2.10) requires an allowed one
    const origin = () =>
      new URL((process.env["ADMIN_CORS"] ?? "").split(",")[0]?.trim() ?? "").origin

    const call = (headers: Record<string, string>) => ({
      get: <T>(url: string) => settle(http.get<T & Answer>(url, { headers })),
      post: <T>(url: string, body: unknown = {}) =>
        settle(http.post<T & Answer>(url, body, { headers })),
    })
    const anyone = call({})
    const signIn = (email: string, password: string) =>
      settle(http.post<{ token?: string }>("/auth/user/emailpass", { email, password }))
    const mailTo = (email: string, template: string) =>
      eventually(
        () =>
          Promise.resolve(
            fake.messages.filter((each) => each.to.includes(email) && each.template === template)
          ),
        (found) => found.length > 0
      )

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

    it("shows any role its own profile and lets it change its name and job title only", async () => {
      const member = await createAdminUser(http, getContainer(), "readonly")
      const other = await createAdminUser(http, getContainer(), "operations")
      const me = call(member.plain)

      const before = await me.get<Profile>("/admin/staff/me/profile")
      const saved = await me.post<Profile>("/admin/staff/me/profile", {
        first_name: " Elif ",
        last_name: "Kaya",
        job_title: "Depo sorumlusu",
      })
      const cleared = await me.post<Profile>("/admin/staff/me/profile", {
        first_name: "Elif",
        last_name: "Kaya",
        job_title: "",
      })
      // Nobody else's: no id is read, another field is refused, Medusa's user route stays the owner's
      const aimed = await me.post("/admin/staff/me/profile", {
        first_name: "Elif",
        last_name: "Kaya",
        id: other.userId,
      })
      const core = await me.post(`/admin/users/${other.userId}`, { first_name: "X" })
      const otherAfter = await call(other.plain).get<Profile>("/admin/staff/me/profile")

      expect(before.status).toBe(200)
      expect(before.data.profile).toMatchObject({
        id: member.userId,
        email: member.email,
        role: "readonly",
        job_title: null,
      })
      expect(saved.data.profile).toMatchObject({
        first_name: "Elif",
        last_name: "Kaya",
        job_title: "Depo sorumlusu",
      })
      expect(cleared.data.profile.job_title).toBeNull()
      expect(aimed.status).toBe(400)
      expect(core.status).toBe(403)
      expect(otherAfter.data.profile.first_name).not.toBe("X")
    })

    it("changes the password with the current one, ends the other sessions and tells the member", async () => {
      const member = await createAdminUser(http, getContainer(), "operations")
      const here = sessionCookie(await http.post("/auth/session", {}, { headers: member.plain }))
      const there = sessionCookie(await http.post("/auth/session", {}, { headers: member.plain }))
      const fresh = randomUUID()
      const browser = call({ cookie: here, origin: origin() })

      const counted = await browser.get<Profile>("/admin/staff/me/profile")
      const wrong = await browser.post("/admin/staff/me/password", {
        current_password: "yanlis-sifre-2026",
        new_password: fresh,
      })
      const weak = await browser.post("/admin/staff/me/password", {
        current_password: member.password,
        new_password: "kısa",
      })
      const changed = await browser.post<{ sessions_ended: number }>("/admin/staff/me/password", {
        current_password: member.password,
        new_password: fresh,
      })
      const stays = await browser.get("/admin/staff/me")
      const ended = await call({ cookie: there }).get("/admin/staff/me")

      expect(counted.data.sessions.open).toBeGreaterThanOrEqual(2)
      expect([wrong.status, wrong.data.code ?? wrong.data.message]).toEqual([
        400,
        "staff.password_wrong",
      ])
      expect(weak.status).toBe(400)
      expect(weak.data.code ?? weak.data.message).toBe("auth.password_too_short")
      expect(changed.status).toBe(200)
      expect(changed.data.sessions_ended).toBe(1)
      expect(stays.status).toBe(200)
      expect(ended.status).toBe(401)
      expect((await signIn(member.email, member.password)).status).toBe(401)
      expect((await signIn(member.email, fresh)).status).toBe(200)
      const told = await mailTo(member.email, "staff_account_changed")
      expect(told[0]?.subject).toMatch(/şifreniz değiştirildi$/)
      // No password in the message
      expect(told[0]?.html).not.toContain(fresh)
    })

    it("counts password tries against the member: the eleventh in a quarter of an hour is refused", async () => {
      const member = await createAdminUser(http, getContainer(), "readonly")
      const me = call(member.plain)
      const tries: number[] = []
      for (let index = 0; index < 11; index += 1) {
        tries.push(
          (
            await me.post("/admin/staff/me/password", {
              current_password: `yanlis-${String(index)}`,
              new_password: randomUUID(),
            })
          ).status
        )
      }
      expect(tries.slice(0, 10)).toEqual(Array(10).fill(400))
      expect(tries[10]).toBe(429)
    })

    it("asks a member with 2FA for its code before their password is changed", async () => {
      const member = await createAdminUser(http, getContainer(), "admin")
      const { secret } = await setUpTotp(http, member)
      const fresh = randomUUID()
      const body = { current_password: member.password, new_password: fresh }

      const bare = await call(member.plain).post("/admin/staff/me/password", body)
      const byPassword = await call(member.headers).post("/admin/staff/me/password", body)
      const withCode = await call({
        ...member.plain,
        "x-reauth-method": "totp",
        "x-reauth-secret": totp(secret, 1),
      }).post("/admin/staff/me/password", body)

      expect([bare.status, bare.data.message]).toEqual([428, "staff.reauth_required"])
      expect([byPassword.status, byPassword.data.message]).toEqual([428, "staff.reauth_failed"])
      expect(withCode.status).toBe(200)
      // The new password signs in, still with the second step
      const login = await settle(
        http.post<{ mfa_challenge?: unknown }>("/auth/user/emailpass", {
          email: member.email,
          password: fresh,
        })
      )
      expect(login.data.mfa_challenge).toBeDefined()
    })

    it("moves the login to a new address only once the link sent there is used, once", async () => {
      const member = await createAdminUser(http, getContainer(), "operations")
      const me = call(member.plain)
      const next = `yeni-${randomUUID()}@example.com`

      const wrong = await me.post("/admin/staff/me/email", {
        email: next,
        current_password: "yanlis-sifre-2026",
      })
      const asked = await me.post<{ sent: boolean }>("/admin/staff/me/email", {
        email: next.toUpperCase(),
        current_password: member.password,
      })
      const pending = await me.get<Profile>("/admin/staff/me/profile")
      const [link] = await mailTo(next, "staff_email_confirm")
      const [notice] = await mailTo(member.email, "staff_account_changed")
      const token = tokenIn(link?.html ?? "")

      const confirmed = await anyone.post("/admin/staff/email/confirm", { token })
      const again = await anyone.post("/admin/staff/email/confirm", { token })
      const after = await me.get<Profile>("/admin/staff/me/profile")

      expect(wrong.data.code ?? wrong.data.message).toBe("staff.password_wrong")
      expect(asked.status).toBe(202)
      expect(pending.data.profile.email).toBe(member.email)
      expect(notice?.subject).toMatch(/değişikliği istendi$/)
      // The old address sees the new one masked
      expect(notice?.html).not.toContain(next)
      expect(confirmed.status).toBe(200)
      expect(again.data.code ?? again.data.message).toBe("staff.email_change_invalid")
      expect(after.data.profile.email).toBe(next)
      expect((await signIn(next, member.password)).status).toBe(200)
      expect((await signIn(member.email, member.password)).status).toBe(401)
      const told = await eventually(
        () =>
          Promise.resolve(
            fake.messages.filter(
              (each) => each.to.includes(member.email) && each.template === "staff_account_changed"
            )
          ),
        (found) => found.length >= 2
      )
      expect(told.map((each) => each.subject)).toContainEqual(
        expect.stringMatching(/e-posta adresiniz değişti$/)
      )
    })

    it("refuses an expired link, a teammate's address, and a login's address at confirmation", async () => {
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
        { user_id: member.userId, from: member.email, to: `x-${randomUUID()}@example.com` },
        key,
        Date.now() - 2 * EMAIL_CHANGE_TTL_MS
      ).token

      const old = await anyone.post("/admin/staff/email/confirm", { token: expired })
      const taken = await me.post("/admin/staff/me/email", {
        email: teammate.email,
        current_password: member.password,
      })
      const same = await me.post("/admin/staff/me/email", {
        email: member.email,
        current_password: member.password,
      })
      // A customer's address is not told at the ask; the link is refused
      const asked = await me.post("/admin/staff/me/email", {
        email: customer,
        current_password: member.password,
      })
      const [link] = await mailTo(customer, "staff_email_confirm")
      const confirmed = await anyone.post("/admin/staff/email/confirm", {
        token: tokenIn(link?.html ?? ""),
      })

      expect(old.data.code ?? old.data.message).toBe("staff.email_change_invalid")
      expect(taken.data.code ?? taken.data.message).toBe("staff.email_unavailable")
      expect(same.data.code ?? same.data.message).toBe("staff.email_same")
      expect(asked.status).toBe(202)
      expect(confirmed.data.code ?? confirmed.data.message).toBe("staff.email_unavailable")
      expect((await me.get<Profile>("/admin/staff/me/profile")).data.profile.email).toBe(
        member.email
      )
    })

    it("ends the member's other sessions on request, with their proof", async () => {
      const member = await createAdminUser(http, getContainer(), "operations")
      const here = sessionCookie(await http.post("/auth/session", {}, { headers: member.plain }))
      const there = sessionCookie(await http.post("/auth/session", {}, { headers: member.plain }))
      const browser = { cookie: here, origin: origin() }

      const bare = await call(browser).post("/admin/staff/me/sessions/end-others")
      const ended = await call({
        ...browser,
        "x-reauth-method": "password",
        "x-reauth-secret": encodeURIComponent(member.password),
      }).post<{ ended: number }>("/admin/staff/me/sessions/end-others")

      expect(bare.status).toBe(428)
      expect(ended.data.ended).toBe(1)
      expect((await call({ cookie: here }).get("/admin/staff/me")).status).toBe(200)
      expect((await call({ cookie: there }).get("/admin/staff/me")).status).toBe(401)
    })
  },
})
