import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { createMemorySessionIndex } from "../../../lib/staff/session-index"
import type { SessionIndex } from "../../../lib/staff/session-index"
import type { MemberState } from "../../../modules/cp-staff/service"
import { checkCredential, standingOf } from "../caller"
import { noteSessionStart } from "../sessions"

let index: SessionIndex = createMemorySessionIndex()

jest.mock("../../../lib/staff/session-index", () => {
  const actual = jest.requireActual<Record<string, unknown>>("../../../lib/staff/session-index")
  return { ...actual, sessionIndex: () => index }
})

const member = (changes: Partial<MemberState> = {}): MemberState => ({
  role: "operator",
  active: true,
  enrolBy: null,
  enrolTokenHash: null,
  bootstrap: false,
  mfaValidAfter: null,
  tokensValidAfter: null,
  ...changes,
})

const bearer = (iat: number | null, mfaPassedAt: string | null = null) => ({
  kind: "bearer" as const,
  iat,
  jti: null,
  mfaPassedAt,
})

beforeEach(() => {
  index = createMemorySessionIndex()
})

describe("checkCredential (Ek C4, M1)", () => {
  it("takes a session only while the member's index holds it", async () => {
    await index.add("user_1", "sid-a", 60_000)

    expect(await checkCredential({ kind: "session", sid: "sid-a" }, "user_1", member(), true)).toBe(
      "ok"
    )
    expect(await checkCredential({ kind: "session", sid: "sid-b" }, "user_1", member(), true)).toBe(
      "session_revoked"
    )
    expect(await checkCredential({ kind: "session", sid: "sid-a" }, "user_2", member(), true)).toBe(
      "session_revoked"
    )
  })

  it("takes no bearer token once deployed", async () => {
    expect(await checkCredential(bearer(2_000_000_000), "user_1", member(), true)).toBe(
      "session_required"
    )
    expect(await checkCredential(bearer(2_000_000_000), "user_1", member(), false)).toBe("ok")
  })

  it("refuses a token from before the member's last revocation", async () => {
    const after = new Date("2026-11-11T10:00:00.500Z")
    const revoked = member({ tokensValidAfter: after })

    // Passed 2FA: judged to the millisecond
    expect(
      await checkCredential(bearer(0, "2026-11-11T10:00:00.400Z"), "user_1", revoked, false)
    ).toBe("token_revoked")
    expect(
      await checkCredential(bearer(0, "2026-11-11T10:00:00.600Z"), "user_1", revoked, false)
    ).toBe("ok")
    // Not passed (the setup only): by its issue second
    expect(
      await checkCredential(bearer(after.getTime() / 1000 - 1), "user_1", revoked, false)
    ).toBe("token_revoked")
    expect(await checkCredential(bearer(null), "user_1", revoked, false)).toBe("token_revoked")
  })
})

describe("standingOf (M3)", () => {
  it("grants a role only once enrolled, and nothing past the deadline or deactivated", () => {
    const now = Date.parse("2026-11-11T10:00:00Z")

    expect(standingOf(member(), now)).toEqual({ role: "operator", pending: false })
    expect(standingOf(member({ enrolBy: new Date(now + 1000) }), now)).toEqual({
      role: "operator",
      pending: true,
    })
    expect(standingOf(member({ enrolBy: new Date(now - 1000) }), now)).toEqual({
      role: null,
      pending: false,
    })
    expect(standingOf(member({ active: false }), now)).toEqual({ role: null, pending: false })
    expect(standingOf(null, now)).toEqual({ role: null, pending: false })
  })
})

describe("noteSessionStart (L7)", () => {
  function signedInRequest() {
    const session: { auth_context: unknown; cookie: object } = {
      auth_context: { actor_type: "user", actor_id: "user_1" },
      cookie: { originalMaxAge: 60_000 },
    }
    const end = jest.fn()
    const res = { statusCode: 200, end } as unknown as MedusaResponse
    const req = {
      session,
      sessionID: "sid-1",
      scope: { resolve: () => ({ error: jest.fn(), warn: jest.fn() }) },
    } as unknown as MedusaRequest
    return { req, res, end, session }
  }

  it("notes the session before the answer goes", async () => {
    const { req, res, end } = signedInRequest()
    noteSessionStart(req, res, jest.fn())

    res.end()
    await new Promise((resolve) => setImmediate(resolve))

    expect(await index.has("user_1", "sid-1")).toBe(true)
    expect(end).toHaveBeenCalledTimes(1)
  })

  it("takes the sign-in off a session it cannot note, and still answers", async () => {
    index = { ...createMemorySessionIndex(), add: () => Promise.reject(new Error("redis down")) }
    const { req, res, end, session } = signedInRequest()
    noteSessionStart(req, res, jest.fn())

    res.end()
    await new Promise((resolve) => setImmediate(resolve))

    expect(session.auth_context).toBeNull()
    expect(end).toHaveBeenCalledTimes(1)
  })
})
