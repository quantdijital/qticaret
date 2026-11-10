import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { issueStepUpProof, parseKey, stepUpKey } from "@qticaret/server-kit"
import { CP_STAFF_MODULE } from "../../src/modules/cp-staff"
import type CpStaffModuleService from "../../src/modules/cp-staff/service"
import { disableAllFactors } from "../../src/lib/staff/mfa"
import {
  anyStatus,
  bearer,
  makeMember,
  openSession,
  signInWithCode,
  signInWithRecoveryCode,
  stepUp,
  tokenOf,
  tokenOfLink,
} from "../helpers/staff"
import type { HttpClient, Member } from "../helpers/staff"
import { freshCode } from "../helpers/totp"

jest.setTimeout(180 * 1000)

const claimsOf = (headers: Record<string, string>) => {
  const [, payload = ""] = (headers["authorization"] ?? "").split(".")
  return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as {
    jti?: string
    iat?: number
  }
}

/**
 * adr/0061 §3.5 (C4, Ek C4): a step-up proof runs out and binds its own
 * credential; wrong proofs lock the credential they come from, not the
 * person (M2); a sign-in's second step counts against the challenge's own
 * login (M4); a 2FA reset opens setup only through its e-mailed link, by a
 * deadline (M3).
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: Member

    beforeAll(async () => {
      owner = await makeMember(http, getContainer(), "owner")
    })

    const tryStepUp = (headers: Record<string, string>, method: string, code: string) =>
      http.post("/admin/cp/me/step-up", { method, code }, { ...anyStatus, headers })

    it("refuses a step-up proof once it has run out (five minutes)", async () => {
      const key = stepUpKey(parseKey(process.env["CP_HASH_KEY"] ?? "", "CP_HASH_KEY"))
      const claims = claimsOf(owner.headers)
      const scope = `b:${claims.jti ?? String(claims.iat ?? "none")}`
      const binding = `${owner.userId}\n${owner.identity}\n${scope}`
      const stale = issueStepUpProof(binding, key, Date.now() - 6 * 60 * 1000)
      const fresh = issueStepUpProof(binding, key)
      const recovery = (headers: Record<string, string>) =>
        http.post("/admin/cp/me/mfa/recovery-codes", {}, { ...anyStatus, headers })

      const expired = await recovery({ ...owner.headers, "x-cp-step-up": stale.token })
      const valid = await recovery({ ...owner.headers, "x-cp-step-up": fresh.token })

      expect(expired.status).toBe(428)
      expect(expired.data).toMatchObject({ message: "cp.step_up_invalid" })
      expect(valid.status).toBe(200)
      owner.recoveryCodes = (valid.data as { recovery_codes: string[] }).recovery_codes
    })

    it("binds a proof to its own credential: no other session or token (L4)", async () => {
      const member = await makeMember(http, getContainer(), "readonly")
      const a = await openSession(http, member)
      const b = await openSession(http, member)
      const proofA = (await stepUp(http, member, a))["x-cp-step-up"] ?? ""
      const proofToken = (await stepUp(http, member))["x-cp-step-up"] ?? ""
      const otherToken = bearer(await signInWithRecoveryCode(http, member))
      const revoke = (headers: Record<string, string>) =>
        http.post("/admin/cp/me/mfa/recovery-codes", {}, { ...anyStatus, headers })

      expect((await revoke({ ...b, "x-cp-step-up": proofA })).status).toBe(428)
      expect((await revoke({ ...otherToken, "x-cp-step-up": proofToken })).status).toBe(428)
      expect((await revoke({ ...a, "x-cp-step-up": proofA })).status).toBe(200)
    })

    it("locks a stolen session's guesses, not its owner's own session (M2)", async () => {
      const member = await makeMember(http, getContainer(), "finance")
      const own = await openSession(http, member)
      const stolen = await openSession(http, member)
      const guesses: number[] = []
      for (let i = 0; i < 11; i += 1) {
        guesses.push((await tryStepUp(stolen, "totp", String(200000 + i))).status)
      }
      const stolenRight = await tryStepUp(stolen, "recovery_code", member.recoveryCodes[0] ?? "")
      const ownRight = await tryStepUp(own, "recovery_code", member.recoveryCodes.shift() ?? "")

      expect(guesses.slice(0, 10).every((status) => status === 403)).toBe(true)
      expect(guesses[10]).toBe(429)
      expect(stolenRight.status).toBe(429)
      expect(ownRight.status).toBe(200)
    })

    it("lets a sign-in with a code minutes ago end the other sessions, no step-up (M2)", async () => {
      const member = await makeMember(http, getContainer(), "operator")
      const old = await openSession(http, member)
      const token = await signInWithCode(http, member)
      const session = await http.post("/auth/session", {}, { ...anyStatus, headers: bearer(token) })
      const raw = session.headers["set-cookie"]
      const fresh = {
        cookie: ((Array.isArray(raw) ? raw[0] : raw) ?? "").split(";")[0] ?? "",
        origin: "http://localhost:5174",
      }
      const revoked = await http.post(
        "/admin/cp/me/sessions/revoke-others",
        {},
        { ...anyStatus, headers: fresh }
      )
      // Anything else still asks the proof
      const codes = await http.post(
        "/admin/cp/me/mfa/recovery-codes",
        {},
        { ...anyStatus, headers: fresh }
      )

      expect(revoked.status).toBe(200)
      expect((await http.get("/admin/cp/me", { ...anyStatus, headers: old })).status).toBe(401)
      expect(codes.status).toBe(428)
    })

    it("counts a sign-in's wrong codes against the challenge's own login (M4)", async () => {
      const member = await makeMember(http, getContainer(), "readonly")
      const signInStep = async () => {
        const login = await http.post<{ token: string; mfa_challenge?: { id: string } }>(
          "/auth/user/emailpass",
          { email: member.email, password: member.password },
          anyStatus
        )
        return { id: login.data.mfa_challenge?.id ?? "", token: login.data.token }
      }
      const verify = (challenge: { id: string; token: string }, method: string, code: string) =>
        http.post(
          `/auth/mfa/challenges/${challenge.id}/verify`,
          { method, code },
          { ...anyStatus, headers: bearer(challenge.token) }
        )

      const first = await signInStep()
      const unknown = await verify({ ...first, id: "authmfachal_unknown" }, "totp", "123456")
      const wrong: number[] = []
      for (const challenge of [first, await signInStep()]) {
        for (let i = 0; i < 5; i += 1) {
          wrong.push((await verify(challenge, "recovery_code", `wrong-${String(i)}`)).status)
        }
      }
      const locked = await verify(
        await signInStep(),
        "recovery_code",
        member.recoveryCodes[0] ?? ""
      )
      // The member's own signed-in token proves itself still: another scope
      const stillProves = await tryStepUp(
        member.headers,
        "recovery_code",
        member.recoveryCodes.shift() ?? ""
      )

      expect(unknown.status).toBe(401)
      expect(unknown.data).toMatchObject({ message: "cp.challenge_unknown" })
      expect(wrong.every((status) => status >= 400 && status < 500)).toBe(true)
      expect(locked.status).toBe(429)
      expect(stillProves.status).toBe(200)
    })

    it("opens setup after a reset only through its link, by its deadline (M3)", async () => {
      const resetter = await makeMember(http, getContainer(), "owner")
      const member = await makeMember(http, getContainer(), "operator")
      const reset = await http.post<{ link: string }>(
        `/admin/cp/staff/members/${member.userId}/reset-mfa`,
        {},
        { ...anyStatus, headers: await stepUp(http, resetter) }
      )
      const oldToken = await http.get("/admin/cp/me", { ...anyStatus, headers: member.headers })
      const plain = bearer(
        tokenOf(
          await http.post("/auth/user/emailpass", {
            email: member.email,
            password: member.password,
          })
        )
      )
      const started = await http.post<{ secret: string }>(
        "/admin/cp/me/mfa",
        {},
        { ...anyStatus, headers: plain }
      )
      member.used = new Set<string>()
      member.secret = started.data.secret
      const verify = (extra: object, code = "000000") =>
        http.post(
          "/admin/cp/me/mfa/verify",
          { code, password: member.password, ...extra },
          { ...anyStatus, headers: plain }
        )
      const withoutLink = await verify({})
      const withLink = await verify(
        { enrolment_token: tokenOfLink(reset.data.link) },
        freshCode(member.secret, member.used)
      )
      const again = await verify({ enrolment_token: tokenOfLink(reset.data.link) })
      const signedIn = bearer(await signInWithCode(http, member))

      expect(reset.status).toBe(200)
      expect(reset.data.link).toMatch(/^http:\/\/localhost:5174\/enrol#token=/)
      expect(oldToken.status).toBe(401)
      expect(started.status).toBe(200)
      expect(withoutLink.status).toBe(403)
      expect(withoutLink.data).toMatchObject({ message: "cp.enrolment_token_invalid" })
      expect(withLink.status).toBe(200)
      // Spent: the factor is on and the link is gone
      expect(again.status).toBeGreaterThanOrEqual(400)
      expect(
        (await http.get("/admin/cp/me/sessions", { ...anyStatus, headers: signedIn })).status
      ).toBe(200)

      // A member who lets a reset's deadline pass reaches nothing, the setup included
      await disableAllFactors(getContainer(), member.identity)
      await getContainer()
        .resolve<CpStaffModuleService>(CP_STAFF_MODULE)
        .requireEnrolment(member.userId, "x".repeat(32), new Date(Date.now() - 1000))
      const late = bearer(
        tokenOf(
          await http.post("/auth/user/emailpass", {
            email: member.email,
            password: member.password,
          })
        )
      )
      const lateSetup = await http.post("/admin/cp/me/mfa", {}, { ...anyStatus, headers: late })
      expect(lateSetup.status).toBe(403)
      expect(lateSetup.data).toMatchObject({ message: "cp.no_role" })
    })
  },
})
