import type { MedusaRequest } from "@medusajs/framework/http"
import { forgetPasswordChange } from "../password-epoch-cache"
import {
  SESSION_SIGNED_IN_AT,
  noteSessionSignIn,
  signInAfterPasswordChange,
  signInOutlived,
} from "../sign-in-epoch"
import { fakeResponse } from "./fakes"

// The answer's shape is the error handler's (its own tests); here only that it refuses
jest.mock("../reject", () => ({
  rejectRequest: (
    _req: unknown,
    res: { status: (code: number) => { json: (body: unknown) => void } },
    status: number,
    body: unknown
  ) => {
    res.status(status).json(body)
  },
}))

const token = (claims: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`

const CHANGED = "2026-11-15T12:00:00.000Z"
const changedSeconds = Math.floor(new Date(CHANGED).getTime() / 1000)

function request(fields: {
  bearer?: Record<string, unknown>
  session?: Record<string, unknown>
  changedAt?: string | null
}) {
  const destroy = jest.fn((callback: () => void) => {
    callback()
  })
  const req = {
    path: "/store/carts/cart_1",
    originalUrl: "/store/carts/cart_1",
    method: "GET",
    headers: fields.bearer ? { authorization: `Bearer ${token(fields.bearer)}` } : {},
    session: fields.session ? { ...fields.session, destroy } : undefined,
    scope: {
      resolve: () => ({
        retrieveAuthIdentity: () =>
          Promise.resolve({
            app_metadata: fields.changedAt ? { password_changed_at: fields.changedAt } : {},
          }),
      }),
    },
  } as unknown as MedusaRequest
  return { req, destroy }
}

async function run(req: MedusaRequest) {
  const response = fakeResponse()
  const next = jest.fn()
  await signInAfterPasswordChange(req, response.res, next)
  return { status: response.status(), passed: next.mock.calls.length > 0 }
}

beforeEach(() => {
  forgetPasswordChange("auth_1")
  forgetPasswordChange("auth_x")
})

describe("a changed password ends every older sign-in (ADR-0068 Ek 2026-11-15 (2))", () => {
  it("weighs a sign-in's time against the change; an unstamped session only while it could live", () => {
    expect(signInOutlived(100, null)).toBe(false)
    expect(signInOutlived(100, 200)).toBe(true)
    expect(signInOutlived(200, 200)).toBe(false)
    expect(signInOutlived(null, 1_000, 1_000 + 60)).toBe(true)
    expect(signInOutlived(null, 1_000, 1_000 + 11 * 60 * 60)).toBe(false)
  })

  it("refuses a token given before the change on any Store request", async () => {
    const old = request({
      bearer: { auth_identity_id: "auth_1", iat: changedSeconds - 60 },
      changedAt: CHANGED,
    })
    expect(await run(old.req)).toEqual({ status: 401, passed: false })
  })

  it("lets a token given after the change through, and one of an identity never changed", async () => {
    const fresh = request({
      bearer: { auth_identity_id: "auth_1", iat: changedSeconds + 5 },
      changedAt: CHANGED,
    })
    expect(await run(fresh.req)).toEqual({ status: 200, passed: true })
    forgetPasswordChange("auth_1")
    const never = request({ bearer: { auth_identity_id: "auth_1", iat: 1 }, changedAt: null })
    expect(await run(never.req)).toEqual({ status: 200, passed: true })
  })

  it("ends a session opened before the change", async () => {
    const old = request({
      session: {
        auth_context: { auth_identity_id: "auth_1" },
        [SESSION_SIGNED_IN_AT]: changedSeconds - 60,
      },
      changedAt: CHANGED,
    })
    expect(await run(old.req)).toEqual({ status: 401, passed: false })
    expect(old.destroy).toHaveBeenCalled()
  })

  it("passes a request with no sign-in, and stamps a new session", async () => {
    expect(await run(request({}).req)).toEqual({ status: 200, passed: true })
    const session: Record<string, unknown> = {}
    const next = jest.fn()
    noteSessionSignIn({ session } as unknown as MedusaRequest, fakeResponse().res, next)
    expect(typeof session[SESSION_SIGNED_IN_AT]).toBe("number")
    expect(next).toHaveBeenCalled()
  })

  it("refuses an old session whatever bearer comes beside it, and ends it (review H1)", async () => {
    // Medusa reads the session first: a forged bearer must not hide the session from the check
    const old = request({
      session: {
        auth_context: { auth_identity_id: "auth_1" },
        [SESSION_SIGNED_IN_AT]: changedSeconds - 60,
      },
      bearer: { auth_identity_id: "auth_x", iat: changedSeconds + 60 },
      changedAt: CHANGED,
    })
    expect(await run(old.req)).toEqual({ status: 401, passed: false })
    expect(old.destroy).toHaveBeenCalled()
  })

  it("refuses an old bearer beside a fresh session, the session left alone", async () => {
    const mixed = request({
      session: {
        auth_context: { auth_identity_id: "auth_1" },
        [SESSION_SIGNED_IN_AT]: changedSeconds + 60,
      },
      bearer: { auth_identity_id: "auth_x", iat: changedSeconds - 60 },
      changedAt: CHANGED,
    })
    expect(await run(mixed.req)).toEqual({ status: 401, passed: false })
    expect(mixed.destroy).not.toHaveBeenCalled()
  })

  it("does not hold a failed read as never changed (review INFO)", async () => {
    const retrieve = jest
      .fn()
      .mockRejectedValueOnce(new Error("database away"))
      .mockResolvedValueOnce({ app_metadata: { password_changed_at: CHANGED } })
    const req = {
      path: "/store/carts",
      originalUrl: "/store/carts",
      method: "GET",
      headers: {
        authorization: `Bearer ${token({ auth_identity_id: "auth_1", iat: changedSeconds - 60 })}`,
      },
      scope: { resolve: () => ({ retrieveAuthIdentity: retrieve }) },
    } as unknown as MedusaRequest
    expect(await run(req)).toEqual({ status: 200, passed: true })
    expect(await run(req)).toEqual({ status: 401, passed: false })
    expect(retrieve).toHaveBeenCalledTimes(2)
  })
})
