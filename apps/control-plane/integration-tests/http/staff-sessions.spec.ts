import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { endSessionsOf } from "../../src/scripts/end-sessions"
import {
  PANEL_ORIGIN,
  anyStatus,
  bearer,
  makeMember,
  openSession,
  signInWithCode,
  stepUp,
} from "../helpers/staff"
import { freshCode } from "../helpers/totp"
import type { HttpClient } from "../helpers/staff"

jest.setTimeout(180 * 1000)

/**
 * adr/0061 §3.5 (C4, Ek C4): a member lists and ends their sessions; a
 * session the index no longer holds reaches nothing (the break-glass CLI
 * included); 2FA turned off and set up again revives no old sign-in (H1);
 * a cookie mutation from another origin is refused (L5).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const me = (headers: Record<string, string>) =>
      http.get("/admin/cp/me", { ...anyStatus, headers })

    it("lists a member's sessions and ends one, and the ended one reaches nothing", async () => {
      const member = await makeMember(http, getContainer(), "finance")
      const a = await openSession(http, member)
      const b = await openSession(http, member)
      const listed = await http.get<{ sessions: { id: string; current: boolean }[] }>(
        "/admin/cp/me/sessions",
        { ...anyStatus, headers: a }
      )
      const other = listed.data.sessions.find((each) => !each.current)
      const bBefore = await me(b)
      const ended = await http.delete(`/admin/cp/me/sessions/${other?.id ?? ""}`, {
        ...anyStatus,
        headers: await stepUp(http, member, a),
      })

      expect(listed.status).toBe(200)
      expect(listed.data.sessions.filter((each) => each.current)).toHaveLength(1)
      expect(listed.data.sessions).toHaveLength(2)
      expect(JSON.stringify(listed.data)).not.toContain(a["cookie"]?.split("=")[1] ?? "-")
      expect(bBefore.status).toBe(200)
      expect(ended.status).toBe(200)
      expect((await me(b)).status).toBe(401)
      expect((await me(a)).status).toBe(200)
    })

    it("ends every other session and token at once, this session kept", async () => {
      const member = await makeMember(http, getContainer(), "operator")
      const a = await openSession(http, member)
      const b = await openSession(http, member)
      const revoked = await http.post<{ ended: number }>(
        "/admin/cp/me/sessions/revoke-others",
        {},
        { ...anyStatus, headers: await stepUp(http, member, a) }
      )

      expect(revoked.status).toBe(200)
      expect(revoked.data.ended).toBe(1)
      expect((await me(b)).status).toBe(401)
      expect((await me(member.headers)).status).toBe(401)
      expect((await me(a)).status).toBe(200)
    })

    it("ends a member's sessions from the server's shell, recorded (cp:end-sessions)", async () => {
      const member = await makeMember(http, getContainer(), "readonly")
      const a = await openSession(http, member)
      const { sessions } = await endSessionsOf(getContainer(), member.email)

      expect(sessions).toBe(1)
      expect((await me(a)).status).toBe(401)
      expect((await me(member.headers)).status).toBe(401)
      await expect(endSessionsOf(getContainer(), "nobody@quant.test")).rejects.toThrow(
        "no such user"
      )
    })

    it("revives no old sign-in once 2FA is off and set up again (H1)", async () => {
      const member = await makeMember(http, getContainer(), "operator")
      const kept = await openSession(http, member)
      const other = await openSession(http, member)
      const off = await http.delete("/admin/cp/me/mfa", {
        ...anyStatus,
        headers: await stepUp(http, member, kept),
      })
      const otherAfterOff = await me(other)
      const tokenAfterOff = await me(member.headers)
      // Set up again from the session it was turned off in: a new factor
      const started = await http.post<{ secret: string }>(
        "/admin/cp/me/mfa",
        {},
        { ...anyStatus, headers: kept }
      )
      member.used = new Set<string>()
      member.secret = started.data.secret
      const confirmed = await http.post(
        "/admin/cp/me/mfa/verify",
        { code: freshCode(member.secret, member.used), password: member.password },
        { ...anyStatus, headers: kept }
      )
      // That session's sign-in passed 2FA with the old factor: not with the new one
      const keptAfter = await http.get("/admin/cp/me/sessions", { ...anyStatus, headers: kept })
      const fresh = await signInWithCode(http, member)
      const newSignIn = await http.get("/admin/cp/me/sessions", {
        ...anyStatus,
        headers: bearer(fresh),
      })

      expect(off.status).toBe(200)
      expect(otherAfterOff.status).toBe(401)
      expect(tokenAfterOff.status).toBe(401)
      expect(confirmed.status).toBe(200)
      expect(keptAfter.status).toBe(403)
      expect(keptAfter.data).toMatchObject({ message: "cp.mfa_required" })
      expect(newSignIn.status).toBe(200)
    })

    it("refuses a cookie mutation from another origin or as a form (L5)", async () => {
      const member = await makeMember(http, getContainer(), "readonly")
      const a = await openSession(http, member)
      const post = (headers: Record<string, string>, body: unknown = { method: "totp" }) =>
        http.post("/admin/cp/me/step-up", body, { ...anyStatus, headers })

      const noOrigin = await post({ cookie: a["cookie"] ?? "" })
      const evil = await post({ ...a, origin: "https://evil.example" })
      const form = await post({ ...a, "content-type": "application/x-www-form-urlencoded" }, "a=b")
      const signOut = await http.delete("/auth/session", {
        ...anyStatus,
        headers: { cookie: a["cookie"] ?? "", origin: "https://evil.example" },
      })

      expect(noOrigin.status).toBe(403)
      expect(noOrigin.data).toMatchObject({ message: "errors.csrf_rejected" })
      expect(evil.status).toBe(403)
      expect(form.status).toBe(403)
      expect(signOut.status).toBe(403)
      expect(a["origin"]).toBe(PANEL_ORIGIN)
      expect((await me(a)).status).toBe(200)
    })
  },
})
