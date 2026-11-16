import { randomUUID } from "node:crypto"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createAdminUser } from "../helpers/admin"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { setUpTotp } from "../helpers/mfa"
import { adminOrigin, caller, keyOf, sessionCookie, useFakeMail } from "../helpers/staff-account"
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
  pending_email: { to: string; expires_at: string } | null
}

/** The owner, 2026-11-06: every staff member sees and changes their own account, nobody else's. */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const call = (headers: Record<string, string>) => caller(http, headers)
    const { mail, mailTo } = useFakeMail()
    const signIn = (email: string, password: string) =>
      settle(http.post<{ token?: string }>("/auth/user/emailpass", { email, password }))
    /** A panel sign-in: a session, noted for its member. */
    const openSession = async (bearer: Record<string, string>) =>
      sessionCookie(await http.post("/auth/session", {}, { headers: bearer }))
    /** Workflow runs whose stored state holds this text (none should be stored). */
    const storedRunsWith = async (text: string) => {
      const found: { rows: { count: number }[] } = await getContainer()
        .resolve(ContainerRegistrationKeys.PG_CONNECTION)
        .raw(
          "select count(*)::int as count from workflow_execution where execution::text like ? or context::text like ?",
          [`%${text}%`, `%${text}%`]
        )
      return found.rows[0]?.count
    }

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
      const hidden = await me.post("/admin/staff/me/profile", {
        first_name: "Elif\u0007",
        last_name: "Kaya",
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
      expect(before.data).toMatchObject({
        profile: { id: member.userId, email: member.email, role: "readonly", job_title: null },
        pending_email: null,
      })
      expect(before.data).not.toHaveProperty("sessions")
      expect(saved.data.profile).toMatchObject({
        first_name: "Elif",
        last_name: "Kaya",
        job_title: "Depo sorumlusu",
      })
      expect(cleared.data.profile.job_title).toBeNull()
      expect([hidden.status, keyOf(hidden.data)]).toEqual([400, "staff.name_invalid"])
      expect(aimed.status).toBe(400)
      expect(core.status).toBe(403)
      expect(otherAfter.data.profile.first_name).not.toBe("X")
    })

    it("changes the password with the current one, renews this session, ends the others and tells the member", async () => {
      const member = await createAdminUser(http, getContainer(), "operations")
      const here = await openSession(member.plain)
      const there = await openSession(member.plain)
      const fresh = randomUUID()
      const browser = call({ cookie: here, origin: adminOrigin() })

      const counted = await browser.get<{ open: number }>("/admin/staff/me/sessions")
      const wrong = await browser.post("/admin/staff/me/password", {
        current_password: "yanlis-sifre-2026",
        new_password: fresh,
      })
      const weak = await browser.post("/admin/staff/me/password", {
        current_password: member.password,
        new_password: "kısa",
      })
      const same = await browser.post("/admin/staff/me/password", {
        current_password: member.password,
        new_password: member.password,
      })
      const changed = await browser.post<{ sessions_ended: number }>("/admin/staff/me/password", {
        current_password: member.password,
        new_password: fresh,
      })
      const renewed = sessionCookie(changed)
      const stays = await call({ cookie: renewed }).get("/admin/staff/me")
      const oldId = await call({ cookie: here }).get("/admin/staff/me")
      const ended = await call({ cookie: there }).get("/admin/staff/me")

      expect(counted.data.open).toBe(2)
      expect([wrong.status, keyOf(wrong.data)]).toEqual([400, "staff.password_wrong"])
      expect([weak.status, keyOf(weak.data)]).toEqual([400, "auth.password_too_short"])
      expect([same.status, keyOf(same.data)]).toEqual([400, "staff.password_same"])
      expect(changed.status).toBe(200)
      expect(changed.data.sessions_ended).toBe(1)
      expect(renewed).not.toBe("")
      expect(renewed).not.toBe(here)
      expect(stays.status).toBe(200)
      expect(oldId.status).toBe(401)
      expect(ended.status).toBe(401)
      expect(
        (await call({ cookie: renewed }).get<{ open: number }>("/admin/staff/me/sessions")).data
          .open
      ).toBe(1)
      expect((await signIn(member.email, member.password)).status).toBe(401)
      expect((await signIn(member.email, fresh)).status).toBe(200)
      const told = await mailTo(member.email, "staff_account_changed")
      expect(told[0]?.subject).toMatch(/şifreniz değiştirildi$/)
      expect(told[0]?.html).not.toContain(fresh)
      // No workflow run keeps a password, the failed one (the weak password) included
      expect(await storedRunsWith(member.password)).toBe(0)
      expect(await storedRunsWith(fresh)).toBe(0)
      expect(await storedRunsWith("kısa")).toBe(0)
    })

    it("counts password tries against the member from any address, the step-up's tally too", async () => {
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
      // Wrong current passwords count as wrong proofs: a step-up is stopped too
      const stepUp = await call(member.headers).post("/admin/staff/me/sessions/end-others")

      expect(tries.slice(0, 10)).toEqual(Array(10).fill(400))
      expect(tries[10]).toBe(429)
      expect([stepUp.status, keyOf(stepUp.data)]).toEqual([429, "staff.reauth_locked"])
    })

    it("asks a member with 2FA for its code, and its code does not stand in for the password", async () => {
      const member = await createAdminUser(http, getContainer(), "admin")
      const { secret, code: setUpCode } = await setUpTotp(http, member)
      const fresh = randomUUID()
      const body = { current_password: member.password, new_password: fresh }
      // A code is taken once, within a step either side of now: each call gets one not
      // given before (a fixed "step before" met the set-up's code across a 30 s boundary)
      const given = [setUpCode]
      const withCode = () => {
        const code = [1, -1, 0]
          .map((step) => totp(secret, step))
          .find((each) => !given.includes(each))
        if (!code) {
          throw new Error("every code Medusa would take now was given already")
        }
        given.push(code)
        return call({ ...member.plain, "x-reauth-method": "totp", "x-reauth-secret": code })
      }

      const bare = await call(member.plain).post("/admin/staff/me/password", body)
      const byPassword = await call(member.headers).post("/admin/staff/me/password", body)
      const wrongPassword = await withCode().post("/admin/staff/me/password", {
        current_password: "yanlis-sifre-2026",
        new_password: fresh,
      })
      const right = await withCode().post("/admin/staff/me/password", body)

      expect([bare.status, keyOf(bare.data)]).toEqual([428, "staff.reauth_required"])
      expect([byPassword.status, keyOf(byPassword.data)]).toEqual([428, "staff.reauth_failed"])
      expect([wrongPassword.status, keyOf(wrongPassword.data)]).toEqual([
        400,
        "staff.password_wrong",
      ])
      expect(right.status).toBe(200)
      // The new password signs in, still with the second step
      const login = await settle(
        http.post<{ mfa_challenge?: unknown }>("/auth/user/emailpass", {
          email: member.email,
          password: fresh,
        })
      )
      expect(login.data.mfa_challenge).toBeDefined()
      expect(mail().messages.length).toBeGreaterThan(0)
    })

    it("ends the member's other sessions on request, with their proof", async () => {
      const member = await createAdminUser(http, getContainer(), "operations")
      const here = await openSession(member.plain)
      const there = await openSession(member.plain)
      const browser = { cookie: here, origin: adminOrigin() }

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

    it("forgets a session signed out of", async () => {
      const member = await createAdminUser(http, getContainer(), "readonly")
      const here = await openSession(member.plain)
      const there = await openSession(member.plain)

      await settle(
        http.delete("/auth/session", { headers: { cookie: there, origin: adminOrigin() } })
      )
      const counted = await call({ cookie: here }).get<{ open: number }>("/admin/staff/me/sessions")

      expect(counted.data.open).toBe(1)
    })
  },
})
