import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { LoginPage } from "./login-page"

const auth = vi.hoisted(() => ({ verifyChallenge: vi.fn(), fetch: vi.fn() }))
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    auth: { mfa: { verifyChallenge: auth.verifyChallenge } },
    client: { fetch: auth.fetch },
  },
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => navigate,
  useSearch: () => ({}),
}))

interface Answer {
  status: number
  body: Record<string, unknown>
}

/** The backend as the page meets it: its public config, then the sign-in's answers in turn. */
function backend(answers: Answer[], siteKey: string | null = null) {
  const sent: { url: string; headers: Record<string, string> }[] = []
  vi.stubGlobal(
    "fetch",
    vi.fn((url: URL | string, init?: RequestInit) => {
      const path = String(url)
      if (path.endsWith("/admin/public-config")) {
        return Promise.resolve(
          new Response(JSON.stringify({ turnstile: { site_key: siteKey } }), { status: 200 })
        )
      }
      sent.push({ url: path, headers: (init?.headers ?? {}) as Record<string, string> })
      const answer = answers.shift() ?? { status: 500, body: {} }
      return Promise.resolve(new Response(JSON.stringify(answer.body), { status: answer.status }))
    })
  )
  return sent
}

/** Cloudflare's widget, faked: each run hands the next token. */
function fakeTurnstile() {
  let made = 0
  let callback: ((token: string) => void) | undefined
  const api = {
    render: vi.fn((_el: HTMLElement, options: Record<string, unknown>) => {
      callback = options["callback"] as (token: string) => void
      return "w1"
    }),
    execute: vi.fn(() => {
      made += 1
      const token = `tok-${String(made)}`
      queueMicrotask(() => callback?.(token))
    }),
    reset: vi.fn(),
    remove: vi.fn(),
  }
  window.turnstile = api
  return api
}

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
    auth.verifyChallenge.mockReset()
    auth.fetch.mockReset()
    auth.fetch.mockResolvedValue({})
    navigate.mockReset()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
    delete window.turnstile
  })

  it("solves the proof of work asked after five tries, then signs in (adr/0044)", async () => {
    const sent = backend([
      {
        status: 428,
        body: {
          message: "Doğrulama gerekiyor",
          code: "fraud.challenge_required",
          challenge: { token: "login.c2FsdA.4.1.sig", salt: "c2FsdA", bits: 4, expires_at: "" },
        },
      },
      { status: 200, body: { token: "token" } },
    ])
    renderPage()

    await signIn()

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
    expect(sent[1]?.headers["x-challenge"]).toMatch(/^login\.c2FsdA\.4\.1\.sig\.\d+$/)
    expect(auth.fetch).toHaveBeenCalledWith("/auth/session", {
      method: "POST",
      headers: { Authorization: "Bearer token" },
    })
  })

  it("sends Turnstile's token with every sign-in, a fresh one each try (adr/0044 Ek 2026-11-24)", async () => {
    const widget = fakeTurnstile()
    const sent = backend(
      [
        { status: 401, body: { message: "Unauthorized" } },
        { status: 200, body: { token: "token" } },
      ],
      "1x00000000000000000000AA"
    )
    renderPage()

    await signIn()
    expect(await screen.findByRole("alert")).toHaveTextContent("E-posta ya da şifre hatalı.")
    await userEvent.click(screen.getByRole("button", { name: "Giriş yap" }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
    expect(widget.render).toHaveBeenCalledTimes(1)
    const options = widget.render.mock.calls[0]?.[1]
    expect(options).toMatchObject({
      sitekey: "1x00000000000000000000AA",
      action: "staff_login",
      appearance: "interaction-only",
      execution: "execute",
    })
    const tokens = sent.map((each) => each.headers["x-turnstile-token"])
    expect(tokens[0]).toMatch(/^tok-\d+$/)
    expect(tokens[1]).toMatch(/^tok-\d+$/)
    expect(tokens[1]).not.toBe(tokens[0])
    expect(widget.reset).toHaveBeenCalled()
    expect(screen.getByRole("group", { name: "Güvenlik doğrulaması" })).toBeInTheDocument()
  })

  it("says a refused security check in words, and the next try takes a fresh token", async () => {
    fakeTurnstile()
    const sent = backend(
      [
        {
          status: 403,
          body: {
            message: "Güvenlik doğrulaması geçilemedi",
            code: "fraud.turnstile_failed",
            turnstile: { action: "staff_login" },
          },
        },
      ],
      "1x00000000000000000000AA"
    )
    renderPage()

    await signIn()

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Güvenlik doğrulaması geçilemedi. Yeniden deneyin"
    )
    expect(sent).toHaveLength(1)
    expect(navigate).not.toHaveBeenCalled()
  })

  it("answers the stand-in proof in its own header while Cloudflare cannot answer", async () => {
    const sent = backend([
      {
        status: 428,
        body: {
          code: "fraud.challenge_required",
          fallback: "turnstile_unavailable",
          challenge: { token: "ts_staff_login.c2FsdA.4.1.sig", salt: "c2FsdA", bits: 4 },
        },
      },
      { status: 200, body: { token: "token" } },
    ])
    renderPage()

    await signIn()

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/" })
    })
    expect(sent[1]?.headers["x-turnstile-fallback"]).toMatch(
      /^ts_staff_login\.c2FsdA\.4\.1\.sig\.\d+$/
    )
    expect(sent[1]?.headers["x-challenge"]).toBeUndefined()
  })

  it("puts the form first and the product's introduction beside it, with nothing to focus", () => {
    backend([])
    renderPage()

    const form = screen.getByRole("main")
    const intro = screen.getByRole("complementary", { name: "Quant Ticaret" })
    expect(form.compareDocumentPosition(intro) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(within(form).getByRole("heading", { level: 1, name: "Giriş yap" })).toBeInTheDocument()
    expect(within(intro).queryAllByRole("link")).toEqual([])
    expect(within(intro).queryAllByRole("button")).toEqual([])
  })

  it("shows the typed password on request, and hides it again", async () => {
    backend([])
    renderPage()
    const password = screen.getByLabelText("Şifre")
    expect(password).toHaveAttribute("type", "password")

    await userEvent.click(screen.getByRole("button", { name: "Şifreyi göster" }))
    expect(password).toHaveAttribute("type", "text")
    await userEvent.click(screen.getByRole("button", { name: "Şifreyi gizle" }))

    expect(password).toHaveAttribute("type", "password")
  })

  it("says the address or the password is wrong, and stays", async () => {
    backend([{ status: 401, body: { message: "Unauthorized" } }])
    renderPage()

    await signIn()

    expect(await screen.findByRole("alert")).toHaveTextContent("E-posta ya da şifre hatalı.")
    expect(navigate).not.toHaveBeenCalled()
  })

  it("asks the authenticator's code, or a recovery code, before letting in (adr/0040)", async () => {
    backend([
      {
        status: 200,
        body: {
          token: "pending",
          mfa_challenge: { id: "chal_1", methods: ["totp", "recovery_code"] },
        },
      },
    ])
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
