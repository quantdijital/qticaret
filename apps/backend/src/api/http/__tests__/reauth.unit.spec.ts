import type { MedusaRequest } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { logger } from "../../../lib/logging"
import { createMemoryStore } from "../../../lib/security/rate-limit"
import { requireReauth, signInCodeOnce } from "../reauth"
import { fakeRequest, fakeResponse } from "./fakes"

let now = 0
const store = createMemoryStore(() => now)

jest.mock("../rate-limit", () => ({ sharedRateLimitStore: () => store }))

// Throwaway values for these fakes only
const PASSWORD = "Şifre ğüı 1 "
const CODE = "482913"

function request(headers: Record<string, string>, factor = false): MedusaRequest {
  const auth = {
    listAuthMfa: () => Promise.resolve(factor ? [{ id: "mfa_1" }] : []),
    authenticate: (_provider: string, { body }: { body: { password: string } }) =>
      Promise.resolve(
        body.password === PASSWORD
          ? { success: true, authIdentity: { id: "authid_1" } }
          : { success: false }
      ),
    createAuthMfaChallenge: () => Promise.resolve({ id: "chal_1" }),
    verifyAuthMfaChallenge: ({ code }: { code: string }) =>
      code === CODE ? Promise.resolve() : Promise.reject(new Error("wrong code")),
  }
  const users = { listUsers: () => Promise.resolve([{ email: "sahip@example.com" }]) }
  return {
    ...fakeRequest({ path: "/admin/api-access" }),
    headers,
    auth_context: { actor_type: "user", actor_id: "user_1", auth_identity_id: "authid_1" },
    scope: { resolve: (name: string) => (name === Modules.AUTH ? auth : users) },
  } as unknown as MedusaRequest
}

const byPassword = (password: string) => ({
  "x-reauth-method": "password",
  "x-reauth-secret": encodeURIComponent(password),
})

async function run(req: MedusaRequest) {
  const response = fakeResponse()
  const next = jest.fn()
  await requireReauth()(req, response.res, next)
  return { status: next.mock.calls.length > 0 ? 0 : response.status(), body: response.body() }
}

beforeEach(() => {
  // A new person each test: the counters are theirs
  now += 24 * 60 * 60 * 1000 + 1
  jest.spyOn(logger, "warn").mockImplementation(() => undefined)
})

afterEach(() => {
  jest.restoreAllMocks()
})

describe("requireReauth", () => {
  it("takes the password as it was typed, Turkish letters and spaces included", async () => {
    expect((await run(request(byPassword(PASSWORD)))).status).toBe(0)
    expect((await run(request(byPassword(PASSWORD.trim())))).status).toBe(428)
    expect((await run(request({ ...byPassword(""), "x-reauth-secret": "%E0%A4%A" }))).status).toBe(
      428
    )
  })

  it("never stops a person for proofs that were right", async () => {
    const statuses: number[] = []
    for (let n = 0; n < 30; n++) {
      now += 7_000
      statuses.push((await run(request(byPassword(PASSWORD)))).status)
    }

    expect(statuses.every((status) => status === 0)).toBe(true)
  })

  it("stops a person after ten wrong proofs in a quarter of an hour, the right one too", async () => {
    for (let n = 0; n < 10; n++) {
      now += 7_000
      expect((await run(request(byPassword(`yanlis-${String(n)}`)))).status).toBe(428)
    }
    now += 7_000
    const right = await run(request(byPassword(PASSWORD)))
    now += 15 * 60 * 1000
    const later = await run(request(byPassword(PASSWORD)))

    expect(right).toMatchObject({ status: 429, body: { message: "staff.reauth_locked" } })
    expect(later.status).toBe(0)
  })

  it("bounds proofs sent at once, before any is found wrong", async () => {
    const answers = await Promise.all(
      Array.from({ length: 12 }, (_, n) => run(request(byPassword(`yanlis-${String(n)}`))))
    )

    expect(answers.filter(({ status }) => status === 429)).toHaveLength(2)
  })

  it("takes only the app's six digits as a code, and each once", async () => {
    const code = (secret: string) =>
      run(request({ "x-reauth-method": "totp", "x-reauth-secret": secret }, true))

    expect((await code(`0${CODE}`)).status).toBe(428)
    expect((await code(`${CODE.slice(0, 3)} ${CODE.slice(3)}`)).status).toBe(428)
    now += 7_000
    expect((await code(CODE)).status).toBe(0)
    now += 7_000
    expect((await code(CODE)).status).toBe(428)
  })

  it("refuses the password of someone with 2FA", async () => {
    expect((await run(request(byPassword(PASSWORD), true))).status).toBe(428)
  })
})

describe("signInCodeOnce", () => {
  async function signIn(body: Record<string, string>) {
    const req = { ...request({}, true), validatedBody: body } as unknown as MedusaRequest
    const response = fakeResponse()
    const next = jest.fn()
    await signInCodeOnce(req, response.res, next)
    return next.mock.calls.length > 0 ? 0 : response.status()
  }
  const stepUp = () => run(request({ "x-reauth-method": "totp", "x-reauth-secret": CODE }, true))

  it("takes a sign-in's code once: not for a second sign-in, not for a step-up", async () => {
    expect(await signIn({ method: "totp", code: CODE })).toBe(0)
    now += 7_000
    expect(await signIn({ method: "totp", code: CODE })).toBe(401)
    expect((await stepUp()).status).toBe(428)
  })

  it("refuses at sign-in a code a step-up took", async () => {
    expect((await stepUp()).status).toBe(0)
    expect(await signIn({ method: "totp", code: CODE })).toBe(401)
  })

  it("takes only the six digits, and leaves recovery codes to Medusa", async () => {
    expect(await signIn({ method: "totp", code: ` ${CODE}` })).toBe(401)
    expect(await signIn({ method: "recovery_code", code: "ABCD-EFGH" })).toBe(0)
    expect(await signIn({ method: "recovery_code", code: "ABCD-EFGH" })).toBe(0)
  })
})
