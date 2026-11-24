import { beforeEach, describe, expect, it, vi } from "vitest"
import { StoreApiError } from "@/lib/store-api/errors"

const auth = vi.hoisted(() => ({
  claimCart: vi.fn(),
  claimMigration: vi.fn(),
  confirmVerification: vi.fn(),
  createCustomer: vi.fn(),
  login: vi.fn(),
  refreshToken: vi.fn(),
  registerIdentity: vi.fn(),
  requestPasswordReset: vi.fn(),
  requestVerification: vi.fn(),
  resetPassword: vi.fn(),
}))
const redirect = vi.hoisted(() =>
  vi.fn((to: string) => {
    throw Object.assign(new Error("NEXT_REDIRECT"), { to })
  })
)
vi.mock("@/lib/account/auth", () => auth)
vi.mock("next/navigation", () => ({ redirect }))
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }))
const session = vi.hoisted(() => ({
  claimsOf: vi.fn(() => ({})),
  endSession: vi.fn(),
  forgetPending: vi.fn(),
  pendingToken: vi.fn(),
  rememberInvite: vi.fn(),
  rememberPending: vi.fn(),
  startSession: vi.fn(),
  takeInvite: vi.fn(),
}))
vi.mock("@/lib/account/session", () => session)
vi.mock("@/lib/cart/cookie", () => ({ cartIdFromCookie: vi.fn(), forgetCart: vi.fn() }))
vi.mock("@/lib/store-api/server", () => ({ storeCall: vi.fn() }))

const { forgotAction, loginAction, registerAction } = await import("../account")

const INITIAL = { ok: false, error: null, challenge: null }
const formOf = (fields: Record<string, string>) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(fields)) {
    form.set(name, value)
  }
  return form
}
const redirected = (promise: Promise<unknown>) =>
  promise.then(
    () => null,
    (error: unknown) => (error as { to?: string }).to ?? error
  )

/** The sign-in forms' Turnstile tokens, each to its own gate (adr/0044 Ek 2026-11-24). */
describe("account actions behind Turnstile", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("signs in with the form's token; an unverified address's code request carries its own", async () => {
    auth.login.mockResolvedValue({ kind: "verify", token: "pending" })
    auth.requestVerification.mockResolvedValue({})
    const form = formOf({
      email: "ayse@example.com",
      password: "uzun-bir-sifre",
      turnstile: "login-token",
      "turnstile:verification": "code-token",
    })

    await expect(redirected(loginAction(INITIAL, form))).resolves.toBe(
      "/hesap/dogrula?gonderildi=1"
    )
    expect(auth.login).toHaveBeenCalledWith("ayse@example.com", "uzun-bir-sifre", {
      "x-turnstile-token": "login-token",
    })
    expect(auth.requestVerification).toHaveBeenCalledWith("pending", "ayse@example.com", {
      "x-turnstile-token": "code-token",
    })
  })

  it("asks the form for the code request's token when it had none", async () => {
    auth.login.mockResolvedValue({ kind: "verify", token: "pending" })
    auth.requestVerification.mockRejectedValue(
      new StoreApiError(428, "fraud.turnstile_required", null, {
        turnstile: { action: "verification" },
      })
    )

    await expect(
      loginAction(INITIAL, formOf({ email: "ayse@example.com", password: "x", turnstile: "t" }))
    ).resolves.toEqual({
      ok: false,
      error: null,
      challenge: null,
      turnstile: { action: "verification", failed: false },
    })
  })

  it("registers with both tokens on the one send", async () => {
    auth.registerIdentity.mockResolvedValue("reg")
    auth.createCustomer.mockResolvedValue({})
    auth.requestVerification.mockResolvedValue({})
    const form = formOf({
      first_name: "Ayşe",
      last_name: "Yılmaz",
      email: "ayse@example.com",
      phone: "",
      password: "uzun-bir-sifre",
      turnstile: "reg-token",
      "turnstile:verification": "code-token",
    })

    await expect(redirected(registerAction(INITIAL, form))).resolves.toBe(
      "/hesap/dogrula?gonderildi=1&yeni=1"
    )
    expect(auth.registerIdentity).toHaveBeenCalledWith("ayse@example.com", "uzun-bir-sifre", {
      "x-turnstile-token": "reg-token",
    })
    expect(auth.requestVerification).toHaveBeenCalledWith("reg", "ayse@example.com", {
      "x-turnstile-token": "code-token",
    })
  })

  it("sent again after the code's check, resumes at the code: the login is not made twice", async () => {
    const fields = {
      first_name: "Ayşe",
      last_name: "Yılmaz",
      email: "ayse@example.com",
      phone: "",
      password: "uzun-bir-sifre",
      turnstile: "reg-token",
    }
    // First send: the login and its account are made, the code's request waits for Cloudflare
    auth.registerIdentity.mockResolvedValueOnce("reg")
    auth.createCustomer.mockResolvedValue({})
    auth.requestVerification.mockRejectedValueOnce(
      new StoreApiError(428, "fraud.challenge_required", null, {
        challenge: { token: "ts_verification.s.18.1.sig", salt: "s", bits: 18 },
        fallback: "turnstile_unavailable",
      })
    )
    await expect(registerAction(INITIAL, formOf(fields))).resolves.toMatchObject({
      challenge: { fallback: true, action: "verification" },
    })
    expect(session.rememberPending).toHaveBeenCalledWith("reg")

    // Sent again with the stand-in's answer: the address is taken now, the kept key goes on
    auth.registerIdentity.mockRejectedValueOnce(
      new StoreApiError(401, "Identity with email already exists", null)
    )
    session.pendingToken.mockResolvedValueOnce("reg")
    auth.requestVerification.mockResolvedValueOnce({})
    await expect(
      redirected(
        registerAction(
          INITIAL,
          formOf({ ...fields, "turnstile_fallback:verification": "ts_verification.s.18.1.sig.5" })
        )
      )
    ).resolves.toBe("/hesap/dogrula?gonderildi=1&yeni=1")
    expect(auth.createCustomer).toHaveBeenCalledTimes(1)
    expect(auth.requestVerification).toHaveBeenLastCalledWith("reg", "ayse@example.com", {
      "x-turnstile-fallback": "ts_verification.s.18.1.sig.5",
    })
  })

  it("a taken address without a key this browser kept stays a taken address", async () => {
    auth.registerIdentity.mockRejectedValueOnce(
      new StoreApiError(401, "Identity with email already exists", null)
    )
    session.pendingToken.mockResolvedValueOnce(undefined)
    await expect(
      registerAction(
        INITIAL,
        formOf({
          first_name: "Ayşe",
          last_name: "Yılmaz",
          email: "ayse@example.com",
          phone: "",
          password: "uzun-bir-sifre",
        })
      )
    ).resolves.toMatchObject({ error: "account.email_taken" })
    expect(auth.requestVerification).not.toHaveBeenCalled()
  })

  it("a reset link's request hands a refused token back, whatever the address", async () => {
    auth.requestPasswordReset.mockRejectedValue(
      new StoreApiError(403, "fraud.turnstile_failed", null, {
        turnstile: { action: "password_reset" },
      })
    )

    await expect(
      forgotAction(INITIAL, formOf({ email: "ayse@example.com", turnstile: "spent" }))
    ).resolves.toMatchObject({ turnstile: { action: "password_reset", failed: true } })
    expect(auth.requestPasswordReset).toHaveBeenCalledWith("ayse@example.com", {
      "x-turnstile-token": "spent",
    })
  })
})
