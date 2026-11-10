import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { issueStepUpProof, parseKey, stepUpKey } from "@qticaret/server-kit"
import { anyStatus, bearer, makeMember, stepUp } from "../helpers/staff"
import type { Answer, HttpClient, Member } from "../helpers/staff"
import { freshCode } from "../helpers/totp"

jest.setTimeout(180 * 1000)

/** The session cookie a sign-in sets, as a request sends it back. */
function cookieOf(answer: Answer): string {
  const raw = answer.headers["set-cookie"]
  const first = Array.isArray(raw) ? raw[0] : raw
  return (first ?? "").split(";")[0] ?? ""
}

/**
 * adr/0061 §3.5 (C4): a step-up proof runs out and binds its own session;
 * a sign-in's code is taken once; a member lists and ends their sessions;
 * 2FA turned off shuts every session out until it is set up again.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
    })

    /**
     * A cookie session opened from a sign-in that passed 2FA with a recovery
     * code (an app's codes are three at a time, each taken once).
     */
    async function openSession(member: Member): Promise<Record<string, string>> {
      const login = await http.post<{ token: string; mfa_challenge?: { id: string } }>(
        "/auth/user/emailpass",
        { email: member.email, password: member.password },
        anyStatus
      )
      const verified = await http.post<{ token: string }>(
        `/auth/mfa/challenges/${login.data.mfa_challenge?.id ?? ""}/verify`,
        { method: "recovery_code", code: member.recoveryCodes.shift() ?? "" },
        { ...anyStatus, headers: bearer(login.data.token) }
      )
      const token = verified.data.token
      const session = await http.post("/auth/session", {}, { ...anyStatus, headers: bearer(token) })
      return { cookie: cookieOf(session) }
    }

    it("refuses a step-up proof once it has run out (five minutes)", async () => {
      const key = stepUpKey(parseKey(process.env["CP_HASH_KEY"] ?? "", "CP_HASH_KEY"))
      const binding = `${owner.userId}\n${owner.identity}\nbearer`
      const stale = issueStepUpProof(binding, key, Date.now() - 6 * 60 * 1000)
      const fresh = issueStepUpProof(binding, key)
      const recovery = (headers: Record<string, string>) =>
        http.post("/admin/cp/me/mfa/recovery-codes", {}, { ...anyStatus, headers })

      const expired = await recovery({ ...owner.headers, "x-cp-step-up": stale.token })
      const valid = await recovery({ ...owner.headers, "x-cp-step-up": fresh.token })

      expect(expired.status).toBe(428)
      expect(expired.data).toMatchObject({ message: "cp.step_up_invalid" })
      expect(valid.status).toBe(200)
      expect((valid.data as { recovery_codes: string[] }).recovery_codes.length).toBeGreaterThan(0)
      owner.recoveryCodes = (valid.data as { recovery_codes: string[] }).recovery_codes
    })

    it("binds a cookie session's proof to that session", async () => {
      const member = await makeMember(http, getContainer(), "readonly")
      const a = await openSession(member)
      const b = await openSession(member)
      const proofA = await stepUp(http, member, a)

      const elsewhere = await http.post(
        "/admin/cp/me/sessions/revoke-others",
        {},
        { ...anyStatus, headers: { ...b, "x-cp-step-up": proofA["x-cp-step-up"] ?? "" } }
      )

      expect(elsewhere.status).toBe(428)
    })

    it("takes a sign-in's app code once: not again for a step-up", async () => {
      const login = await http.post<{ token: string; mfa_challenge?: { id: string } }>(
        "/auth/user/emailpass",
        { email: owner.email, password: owner.password },
        anyStatus
      )
      const code = freshCode(owner.secret, owner.used)
      const passed = await http.post<{ token: string }>(
        `/auth/mfa/challenges/${login.data.mfa_challenge?.id ?? ""}/verify`,
        { method: "totp", code },
        { ...anyStatus, headers: bearer(login.data.token) }
      )
      const again = await http.post(
        "/admin/cp/me/step-up",
        { method: "totp", code },
        { ...anyStatus, headers: bearer(passed.data.token) }
      )

      expect(passed.status).toBe(200)
      expect(again.status).toBe(403)
      expect(again.data).toMatchObject({ message: "cp.step_up_failed" })
    })

    it("lists a member's sessions and ends one, and the ended one reaches nothing", async () => {
      const member = await makeMember(http, getContainer(), "finance")
      const a = await openSession(member)
      const b = await openSession(member)
      const listed = await http.get<{ sessions: { id: string; current: boolean }[] }>(
        "/admin/cp/me/sessions",
        { ...anyStatus, headers: a }
      )
      const other = listed.data.sessions.find((each) => !each.current)
      const bBefore = await http.get("/admin/cp/me", { ...anyStatus, headers: b })
      const ended = await http.delete(`/admin/cp/me/sessions/${other?.id ?? ""}`, {
        ...anyStatus,
        headers: await stepUp(http, member, a),
      })
      const bAfter = await http.get("/admin/cp/me", { ...anyStatus, headers: b })
      const aAfter = await http.get("/admin/cp/me", { ...anyStatus, headers: a })

      expect(listed.status).toBe(200)
      expect(listed.data.sessions.filter((each) => each.current)).toHaveLength(1)
      expect(listed.data.sessions.length).toBeGreaterThanOrEqual(2)
      expect(JSON.stringify(listed.data)).not.toContain(a["cookie"]?.split("=")[1] ?? "-")
      expect(bBefore.status).toBe(200)
      expect(ended.status).toBe(200)
      expect(bAfter.status).toBe(401)
      expect(aAfter.status).toBe(200)
    })

    it("ends every other session at once, this one kept", async () => {
      const member = await makeMember(http, getContainer(), "operator")
      const a = await openSession(member)
      const b = await openSession(member)
      const revoked = await http.post<{ ended: number }>(
        "/admin/cp/me/sessions/revoke-others",
        {},
        { ...anyStatus, headers: await stepUp(http, member, a) }
      )

      expect(revoked.status).toBe(200)
      expect(revoked.data.ended).toBeGreaterThanOrEqual(1)
      expect((await http.get("/admin/cp/me", { ...anyStatus, headers: b })).status).toBe(401)
      expect((await http.get("/admin/cp/me", { ...anyStatus, headers: a })).status).toBe(200)
    })

    it("stops a member's proofs at ten a minute, a right one included", async () => {
      const member = await makeMember(http, getContainer(), "finance")
      const tryCode = (method: string, code: string) =>
        http.post(
          "/admin/cp/me/step-up",
          { method, code },
          { ...anyStatus, headers: member.headers }
        )

      const wrong: number[] = []
      for (let i = 0; i < 10; i += 1) {
        wrong.push((await tryCode("totp", String(100000 + i))).status)
      }
      const right = await tryCode("recovery_code", member.recoveryCodes[0] ?? "")

      // The setup's password was one proof this minute: nine wrong codes more, then the bound
      expect(wrong.slice(0, 9).every((status) => status === 403)).toBe(true)
      expect(wrong[9]).toBe(429)
      // The route's own limit (ten a quarter per member) answers before the proof lock now
      expect(right.status).toBe(429)
      expect(right.headers["retry-after"]).toBeDefined()
    })

    it("shuts every session out once 2FA is off, until it is set up again", async () => {
      const member = await makeMember(http, getContainer(), "operator")
      const off = await http.delete("/admin/cp/me/mfa", {
        ...anyStatus,
        headers: await stepUp(http, member),
      })
      const after = await http.get("/admin/cp/me/sessions", {
        ...anyStatus,
        headers: member.headers,
      })

      expect(off.status).toBe(200)
      expect(after.status).toBe(403)
      expect(after.data).toMatchObject({ message: "cp.mfa_required" })
    })
  },
})
