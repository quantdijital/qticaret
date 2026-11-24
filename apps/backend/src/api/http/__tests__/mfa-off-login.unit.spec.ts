import type { MedusaRequest } from "@medusajs/framework/http"
import { generateJwtToken } from "@medusajs/framework/utils"
import { generateJwtTokenForAuthIdentity } from "@medusajs/medusa/api/auth/utils/generate-jwt-token"
import { skipMfaChallengeWhenOff } from "../mfa-off-login"
import { mfaAvailable } from "../staff-guard"
import { fakeResponse } from "./fakes"

jest.mock("../staff-guard", () => ({ mfaAvailable: jest.fn() }))
jest.mock("@medusajs/medusa/api/auth/utils/generate-jwt-token", () => ({
  generateJwtTokenForAuthIdentity: jest.fn(),
}))
jest.mock("../../../lib/logging", () => ({
  errorSummary: () => ({}),
  logger: { warn: jest.fn() },
}))

const available = mfaAvailable as jest.MockedFunction<typeof mfaAvailable>
const mint = generateJwtTokenForAuthIdentity as jest.MockedFunction<
  typeof generateJwtTokenForAuthIdentity
>

const SECRET = "unit-test-jwt-secret"

/** The actorless token Medusa answers a challenged login with, signed with `secret`. */
const actorless = (claims: Record<string, unknown>, secret = SECRET) =>
  generateJwtToken(
    { actor_id: "", actor_type: "user", mfa_enabled: true, ...claims },
    { secret, expiresIn: "1h" }
  )

const CHALLENGE = { id: "authmfachal_1", methods: ["totp"] }

const challenged = (token: string) => ({
  mfa_required: true,
  mfa_challenge: CHALLENGE,
  token,
})

function request(identity: Record<string, unknown> | Error) {
  const retrieveAuthIdentity = jest.fn(() =>
    identity instanceof Error ? Promise.reject(identity) : Promise.resolve(identity)
  )
  const req = {
    scope: {
      resolve: (key: string) =>
        key === "configModule"
          ? { projectConfig: { http: { jwtSecret: SECRET, jwtExpiresIn: "1d" } } }
          : { retrieveAuthIdentity },
    },
  } as unknown as MedusaRequest
  return { req, retrieveAuthIdentity }
}

const settled = () =>
  new Promise((resolve) => {
    setImmediate(resolve)
  })

/** The middleware, then Medusa's route answering with `body`; resolves with what was sent. */
async function answer(req: MedusaRequest, body: unknown, status = 200) {
  const fake = fakeResponse()
  const next = jest.fn()
  skipMfaChallengeWhenOff(req, fake.res, next)
  // Express keeps the status on `statusCode`, which the fake does not
  Object.assign(fake.res, { statusCode: status })
  fake.res.status(status).json(body)
  await settled()
  return { sent: fake.body(), next }
}

beforeEach(() => {
  jest.clearAllMocks()
  mint.mockResolvedValue("full-token")
})

describe("skipMfaChallengeWhenOff", () => {
  it("leaves the challenge where 2FA can be asked (deployed, or locally on)", async () => {
    available.mockReturnValue(true)
    const { req, retrieveAuthIdentity } = request({ id: "authid_1" })
    const body = challenged(actorless({ auth_identity_id: "authid_1" }))

    const { sent, next } = await answer(req, body)

    expect(next).toHaveBeenCalledTimes(1)
    expect(sent).toBe(body)
    expect(retrieveAuthIdentity).not.toHaveBeenCalled()
    expect(mint).not.toHaveBeenCalled()
  })

  it("turns a challenged login into a plain one, marked without 2FA, when it is off", async () => {
    available.mockReturnValue(false)
    const identity = { id: "authid_1", app_metadata: { user_id: "user_1" } }
    const { req, retrieveAuthIdentity } = request(identity)

    const { sent, next } = await answer(
      req,
      challenged(actorless({ auth_identity_id: "authid_1" }))
    )

    expect(next).toHaveBeenCalledTimes(1)
    expect(retrieveAuthIdentity).toHaveBeenCalledWith("authid_1", {
      relations: ["provider_identities"],
    })
    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({ authIdentity: identity, actorType: "user", mfaEnabled: false }),
      expect.objectContaining({ secret: SECRET, expiresIn: "1d" })
    )
    expect(sent).toEqual({ token: "full-token" })
  })

  it("keeps the challenge when its token is not signed with the project's secret", async () => {
    available.mockReturnValue(false)
    const { req, retrieveAuthIdentity } = request({
      id: "authid_1",
      app_metadata: { user_id: "user_1" },
    })
    const forged = challenged(actorless({ auth_identity_id: "authid_1" }, "another-secret"))
    const [header, payload] = actorless({ auth_identity_id: "authid_1" }).split(".")
    const unsigned = challenged(`${header ?? ""}.${payload ?? ""}.`)

    const byOtherKey = await answer(req, forged)
    const bare = await answer(req, unsigned)

    expect(byOtherKey.sent).toBe(forged)
    expect(bare.sent).toBe(unsigned)
    expect(retrieveAuthIdentity).not.toHaveBeenCalled()
    expect(mint).not.toHaveBeenCalled()
  })

  it("passes a login without a challenge, and a refusal, as they are", async () => {
    available.mockReturnValue(false)
    const { req } = request({ id: "authid_1", app_metadata: { user_id: "user_1" } })
    const refusal = challenged(actorless({ auth_identity_id: "authid_1" }))

    const plain = await answer(req, { token: "t" })
    const refused = await answer(req, refusal, 401)

    expect(plain.sent).toEqual({ token: "t" })
    expect(refused.sent).toBe(refusal)
    expect(mint).not.toHaveBeenCalled()
  })

  it("keeps the challenge when the identity has no user, or cannot be read", async () => {
    available.mockReturnValue(false)
    const body = challenged(actorless({ auth_identity_id: "authid_1" }))
    const noIdentityBody = challenged(actorless({}))

    const noUser = await answer(request({ id: "authid_1", app_metadata: {} }).req, body)
    const unread = await answer(request(new Error("gone")).req, body)
    const noIdentity = await answer(request({ id: "authid_1" }).req, noIdentityBody)

    expect(noUser.sent).toBe(body)
    expect(unread.sent).toBe(body)
    expect(noIdentity.sent).toBe(noIdentityBody)
    expect(mint).not.toHaveBeenCalled()
  })

  it("sends nothing twice when sending the plain token throws after headers went out", async () => {
    available.mockReturnValue(false)
    const { req } = request({ id: "authid_1", app_metadata: { user_id: "user_1" } })
    const fake = fakeResponse()
    const sent: unknown[] = []
    const res = Object.assign(fake.res, {
      headersSent: false,
      json(body: unknown) {
        sent.push(body)
        res.headersSent = true
        throw new Error("socket closed")
      },
    })
    const unhandled = jest.fn()
    process.on("unhandledRejection", unhandled)

    skipMfaChallengeWhenOff(req, res, jest.fn())
    res.json(challenged(actorless({ auth_identity_id: "authid_1" })))
    await settled()
    await settled()
    process.off("unhandledRejection", unhandled)

    expect(sent).toEqual([{ token: "full-token" }])
    expect(unhandled).not.toHaveBeenCalled()
  })
})
