import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ConfirmEmailPage } from "./confirm-email-page"

const me = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { admin: { user: { me } } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
  useNavigate: () => navigate,
}))

function renderPage(hash = "#token=muhurlu-baglanti-0123456789") {
  window.history.replaceState(null, "", `/confirm-email${hash}`)
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ConfirmEmailPage />
    </QueryClientProvider>
  )
}

describe("ConfirmEmailPage", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    me.mockReset()
    navigate.mockReset()
    fetchMock.mockReset()
    window.sessionStorage.clear()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends a visitor without a session to sign in, keeping the link for this tab only", async () => {
    me.mockRejectedValue({ status: 401 })
    renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "Giriş yap" }))

    expect(navigate).toHaveBeenCalledWith({ to: "/login", search: { redirect: "/confirm-email" } })
    expect(window.sessionStorage.getItem("qt.confirm-email")).toBe("muhurlu-baglanti-0123456789")
    // Out of the address bar: no history entry keeps it
    expect(window.location.hash).toBe("")
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("confirms with a click once signed in, with the link kept across the sign-in", async () => {
    me.mockResolvedValue({ user: { id: "user_1", email: "elif@ornek.com" } })
    window.sessionStorage.setItem("qt.confirm-email", "muhurlu-baglanti-0123456789")
    fetchMock.mockResolvedValue(new Response(JSON.stringify({ changed: true }), { status: 200 }))
    renderPage("")

    expect(await screen.findByText(/elif@ornek\.com hesabıyla giriş yaptınız/u)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole("button", { name: "Adresimi onayla" }))

    expect(await screen.findByText("E-posta adresiniz değişti")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith(
      "/admin/staff/me/email/confirm",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ token: "muhurlu-baglanti-0123456789" }),
      })
    )
    expect(window.sessionStorage.getItem("qt.confirm-email")).toBeNull()
  })

  it("says a stale link in the page's own words", async () => {
    me.mockResolvedValue({ user: { id: "user_1", email: "elif@ornek.com" } })
    fetchMock.mockResolvedValue(
      new Response(JSON.stringify({ code: "staff.email_change_invalid", message: "x" }), {
        status: 400,
      })
    )
    renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "Adresimi onayla" }))

    expect(await screen.findByRole("alert")).toHaveTextContent(/yerine yenisi istenmiş/u)
  })
})
