import type { MedusaRequest } from "@medusajs/framework/http"
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

const actorless = (claims: Record<string, unknown>) =>
  `x.${Buffer.from(JSON.stringify(claims)).toString("base64url")}.y`

const CHALLENGE = { id: "authmfachal_1", methods: ["totp"] }

function request(identity: Record<string, unknown> | Error) {
  const retrieveAuthIdentity = jest.fn(() =>
    identity instanceof Error ? Promise.reject(identity) : Promise.resolve(identity)
  )
  const req = {
    scope: {
      resolve: (key: string) =>
        key === "configModule"
          ? { projectConfig: { http: { jwtSecret: "s", jwtExpiresIn: "1d" } } }
          : { retrieveAuthIdentity },
    },
  } as unknown as MedusaRequest
  return { req, retrieveAuthIdentity }
}

/** The middleware, then Medusa's route answering with `body`; resolves with what was sent. */
async function answer(req: MedusaRequest, body: unknown, status = 200) {
  const fake = fakeResponse()
  const next = jest.fn()
  skipMfaChallengeWhenOff(req, fake.res, next)
  fake.res.status(status).json(body)
  await new Promise((resolve) => setImmediate(resolve))
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
    const body = { mfa_required: true, mfa_challenge: CHALLENGE, token: actorless({}) }

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
    const body = {
      mfa_required: true,
      mfa_challenge: CHALLENGE,
      token: actorless({ auth_identity_id: "authid_1" }),
    }

    const { sent, next } = await answer(req, body)

    expect(next).toHaveBeenCalledTimes(1)
    expect(retrieveAuthIdentity).toHaveBeenCalledWith("authid_1", {
      relations: ["provider_identities"],
    })
    expect(mint).toHaveBeenCalledWith(
      expect.objectContaining({ authIdentity: identity, actorType: "user", mfaEnabled: false }),
      expect.objectContaining({ secret: "s", expiresIn: "1d" })
    )
    expect(sent).toEqual({ token: "full-token" })
  })

  it("passes a login without a challenge, and a refusal, as they are", async () => {
    available.mockReturnValue(false)
    const { req } = request({ id: "authid_1", app_metadata: { user_id: "user_1" } })

    const plain = await answer(req, { token: "t" })
    const refused = await answer(req, { mfa_required: true, token: "t" }, 401)

    expect(plain.sent).toEqual({ token: "t" })
    expect(refused.sent).toEqual({ mfa_required: true, token: "t" })
    expect(mint).not.toHaveBeenCalled()
  })

  it("keeps the challenge when the identity has no user, or cannot be read", async () => {
    available.mockReturnValue(false)
    const body = {
      mfa_required: true,
      mfa_challenge: CHALLENGE,
      token: actorless({ auth_identity_id: "authid_1" }),
    }

    const noUser = await answer(request({ id: "authid_1", app_metadata: {} }).req, body)
    const unread = await answer(request(new Error("gone")).req, body)
    const noIdentity = await answer(request({ id: "authid_1" }).req, {
      ...body,
      token: actorless({}),
    })

    expect(noUser.sent).toBe(body)
    expect(unread.sent).toBe(body)
    expect(noIdentity.sent).toEqual({ ...body, token: actorless({}) })
    expect(mint).not.toHaveBeenCalled()
  })
})
