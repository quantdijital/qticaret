import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { LoginPage } from "./login-page"

const auth = vi.hoisted(() => ({ login: vi.fn(), verifyChallenge: vi.fn(), fetch: vi.fn() }))
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    auth: { login: auth.login, mfa: { verifyChallenge: auth.verifyChallenge } },
    client: { fetch: auth.fetch },
  },
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => navigate,
  useSearch: () => ({}),
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <LoginPage />
    </QueryClientProvider>
  )
}

async function signIn() {
  await userEvent.type(screen.getByLabelText("E-posta"), "deniz@example.com")
  await userEvent.type(screen.getByLabelText("Şifre"), "uzun-bir-sifre")
  await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }))
}

describe("LoginPage", () => {
  beforeEach(() => {
    auth.login.mockReset()
    auth.verifyChallenge.mockReset()
    auth.fetch.mockReset()
    navigate.mockReset()
  })

  it("solves the proof of work asked after five tries, then signs in (adr/0044)", async () => {
    auth.login.mockRejectedValue(Object.assign(new Error("Doğrulama gerekiyor"), { status: 428 }))
    auth.fetch.mockResolvedValue({})
    const answers = [
      {
        status: 428,
        body: {
          message: "Doğrulama gerekiyor",
          challenge: { token: "login.c2FsdA.4.1.sig", salt: "c2FsdA", bits: 4, expires_at: "" },
        },
      },
      { status: 200, body: { token: "token" } },
    ]
    const sent: RequestInit[] = []
    vi.stubGlobal(
      "fetch",
      vi.fn((_url: URL, init: RequestInit) => {
        sent.push(init)
        const answer = answers.shift()
        return Promise.resolve({
          status: answer?.status ?? 500,
          json: () => Promise.resolve(answer?.body ?? {}),
        })
      })
    )
    renderPage()

    await signIn()

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
    expect((sent[1]?.headers as Record<string, string>)["x-challenge"]).toMatch(
      /^login\.c2FsdA\.4\.1\.sig\.\d+$/
    )
    expect(auth.fetch).toHaveBeenCalledWith("/auth/session", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    })
    vi.unstubAllGlobals()
  })

  it("puts the form first and the product's introduction beside it, with nothing to focus", () => {
    renderPage()

    const form = screen.getByRole("main")
    const intro = screen.getByRole("complementary", { name: "Quant Ticaret" })
    expect(form.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(form).getByRole("heading", { level: 1, name: "Giriş yap" })).toBeInTheDocument()
    expect(within(intro).queryAllByRole("link")).toEqual([])
    expect(within(intro).queryAllByRole("button")).toEqual([])
  })

  it("shows the typed password on request, and hides it again", async () => {
    renderPage()
    const password = screen.getByLabelText("Şifre")
    expect(password).toHaveAttribute("type", "password")

    await userEvent.click(screen.getByRole("button", { name: "Şifreyi göster" }))
    expect(password).toHaveAttribute("type", "text")
    await userEvent.click(screen.getByRole("button", { name: "Şifreyi gizle" }))

    expect(password).toHaveAttribute("type", "password")
  })

  it("says the address or the password is wrong, and stays", async () => {
    auth.login.mockRejectedValue(Object.assign(new Error("Unauthorized"), { status: 401 }))
    renderPage()

    await signIn()

    expect(await screen.findByRole("alert")).toHaveTextContent("E-posta ya da şifre hatalı.")
    expect(navigate).not.toHaveBeenCalled()
  })

  it("signs in at once when no code is asked", async () => {
    auth.login.mockResolvedValue("token")
    renderPage()

    await signIn()

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
  })

  it("asks the authenticator's code, or a recovery code, before letting in (adr/0040)", async () => {
    auth.login.mockResolvedValue({
      mfa_required: true,
      mfa_challenge: { id: "chal_1", methods: ["totp", "recovery_code"] },
      token: "pending",
    })
    auth.verifyChallenge.mockResolvedValue("token")
    renderPage()

    await signIn()
    const code = await screen.findByLabelText("Doğrulama kodu")
    expect(navigate).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Kurtarma kodu kullan" }))
    expect(screen.getByLabelText("Kurtarma kodu")).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Uygulamadaki kodu kullan" }))
    await userEvent.type(screen.getByLabelText("Doğrulama kodu"), "123456")
    await userEvent.click(screen.getByRole("button", { name: "Doğrula ve gir" }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
    expect(code).toBeDefined()
    expect(auth.verifyChallenge).toHaveBeenCalledWith("chal_1", { method: "totp", code: "123456" })
  })
})
