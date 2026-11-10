import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { refusal, renderWithQuery, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { SignInPage } from "./sign-in-page"

const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => ({ value: {} }))

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => navigate,
  useSearch: () => search.value,
}))

const CHALLENGE = {
  token: "password-step",
  mfa_challenge: { id: "mfach_1", methods: ["totp", "recovery_code"] },
}

async function signIn(password = "uzun-bir-sifre-123") {
  await userEvent.type(screen.getByLabelText("E-posta"), "deniz@quant.test")
  await userEvent.type(screen.getByLabelText("Şifre"), password)
  await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }))
}

describe("SignInPage (adr/0061 §3.5)", () => {
  beforeEach(() => {
    navigate.mockReset()
    search.value = {}
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("says a wrong password plainly, not Medusa's English", async () => {
    stubApi(() => refusal(401, "Invalid email or password", "unauthorized"))
    renderWithQuery(<SignInPage />)

    await signIn()

    expect(await screen.findByRole("alert")).toHaveTextContent("E-posta ya da şifre hatalı.")
    expect(navigate).not.toHaveBeenCalled()
  })

  it("asks the app's code, verifies it with the password step's token, then opens the session", async () => {
    search.value = { redirect: "/staff" }
    const sent = stubApi((call: Sent): Answer => {
      if (call.path === "/auth/user/emailpass") {
        return { status: 200, body: CHALLENGE }
      }
      if (call.path === "/auth/mfa/challenges/mfach_1/verify") {
        return { status: 200, body: { token: "passed" } }
      }
      return { status: 200, body: { user: { id: "user_1" } } }
    })
    renderWithQuery(<SignInPage />)

    await signIn()
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula ve gir" }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/staff" })
    })
    expect(sent.map((call) => `${call.method} ${call.path}`)).toEqual([
      "POST /auth/user/emailpass",
      "POST /auth/mfa/challenges/mfach_1/verify",
      "POST /auth/session",
    ])
    expect(sent[1]?.headers["authorization"]).toBe("Bearer password-step")
    expect(sent[1]?.body).toEqual({ method: "totp", code: "123456" })
    // Only the token that passed 2FA opens the session; nothing is kept in the browser
    expect(sent[2]?.headers["authorization"]).toBe("Bearer passed")
  })

  it("takes a recovery code instead of the app's", async () => {
    const sent = stubApi((call) =>
      call.path === "/auth/user/emailpass"
        ? { status: 200, body: CHALLENGE }
        : { status: 200, body: { token: "passed" } }
    )
    renderWithQuery(<SignInPage />)

    await signIn()
    await userEvent.click(await screen.findByRole("button", { name: "Kurtarma kodu kullan" }))
    await userEvent.type(screen.getByLabelText("Kurtarma kodu"), "ABCD-EFGH-IJKL")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula ve gir" }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
    expect(sent[1]?.body).toEqual({ method: "recovery_code", code: "ABCD-EFGH-IJKL" })
  })

  it("says a wrong code and lets the person try again", async () => {
    stubApi((call) =>
      call.path === "/auth/user/emailpass"
        ? { status: 200, body: CHALLENGE }
        : refusal(401, "Invalid code", "unauthorized")
    )
    renderWithQuery(<SignInPage />)

    await signIn()
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "000000")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula ve gir" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Kod doğru değil")
    expect(navigate).not.toHaveBeenCalled()
  })

  it("says the lock after too many wrong codes (cp.sign_in_locked)", async () => {
    stubApi((call) =>
      call.path === "/auth/user/emailpass"
        ? { status: 200, body: CHALLENGE }
        : refusal(429, "cp.sign_in_locked", "too_many_requests")
    )
    renderWithQuery(<SignInPage />)

    await signIn()
    await userEvent.type(await screen.findByLabelText("Doğrulama kodu"), "000000")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula ve gir" }))

    expect(await screen.findByRole("alert")).toHaveTextContent("Çok fazla yanlış kod girildi.")
  })

  it("opens the session at once for a member still to set 2FA up (the guard leads to it)", async () => {
    const sent = stubApi((call) =>
      call.path === "/auth/user/emailpass"
        ? { status: 200, body: { token: "setup-only" } }
        : { status: 200, body: {} }
    )
    renderWithQuery(<SignInPage />)

    await signIn()

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
    expect(sent.map((call) => call.path)).toEqual(["/auth/user/emailpass", "/auth/session"])
    expect(sent[1]?.headers["authorization"]).toBe("Bearer setup-only")
  })
})
