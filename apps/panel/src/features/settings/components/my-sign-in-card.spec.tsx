import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MyProfile } from "@/features/settings/api/account"
import { MySignInCard } from "./my-sign-in-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const mine = (pending: MyProfile["pending_email"] = null): MyProfile => ({
  profile: {
    id: "user_1",
    email: "elif@ornek.com",
    first_name: "Elif",
    last_name: "Kaya",
    job_title: null,
    role: "readonly",
    created_at: "2026-10-01T09:00:00.000Z",
  },
  pending_email: pending,
})

function renderCard(open: number | null = 2, pending: MyProfile["pending_email"] = null) {
  fetchMock.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/admin/staff/me/profile"
        ? mine(pending)
        : path === "/admin/staff/me/sessions"
          ? { open }
          : { changed: true }
    )
  )
  return render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MySignInCard />
    </QueryClientProvider>
  )
}

/** The row's "Değiştir": the address's first, the password's second. */
function changeButton(index: number): HTMLElement {
  const button = screen.getAllByRole("button", { name: "Değiştir" })[index]
  if (!button) {
    throw new Error("no such button")
  }
  return button
}

const posts = () => fetchMock.mock.calls.filter(([, init]) => init !== undefined)

describe("MySignInCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("shows the address, a hidden password and the open sessions, each with one action of one size", async () => {
    renderCard(2)

    expect(await screen.findByText("elif@ornek.com")).toBeInTheDocument()
    expect(screen.getByText("2 oturum (bu cihaz dahil)")).toBeInTheDocument()
    const buttons = [
      ...screen.getAllByRole("button", { name: "Değiştir" }),
      screen.getByRole("button", { name: "Diğerlerini kapat" }),
    ]
    expect(buttons).toHaveLength(3)
    for (const button of buttons) {
      expect(button).toHaveClass("w-36")
    }
  })

  it("offers to sign out others only when there are others", async () => {
    renderCard(1)
    await screen.findByText("1 oturum (bu cihaz)")
    expect(screen.getByRole("button", { name: "Diğerlerini kapat" })).toBeDisabled()
    expect(fetchMock).toHaveBeenCalledWith("/admin/staff/me/sessions")
  })

  it("shows a change waiting for its link, and cancels it", async () => {
    renderCard(1, { to: "yeni@ornek.com", expires_at: "2026-11-07T09:00:00.000Z" })

    expect(await screen.findByText("yeni@ornek.com")).toBeInTheDocument()
    expect(screen.getByText(/^Onay bekleyen yeni adres/u)).toBeInTheDocument()
    const cancel = screen.getByRole("button", { name: "İptal et" })
    expect(cancel).toHaveClass("w-36")
    await userEvent.click(cancel)

    expect(posts()).toEqual([["/admin/staff/me/email/cancel", { method: "POST", body: {} }]])
  })

  it("checks the new password before asking the server, then sends the current and the new", async () => {
    renderCard()
    await screen.findByText("elif@ornek.com")
    const passwordButton = changeButton(1)
    await userEvent.click(passwordButton)

    await userEvent.type(screen.getByLabelText(/^Mevcut şifre/u), "eski şifrem burada")
    await userEvent.type(screen.getByLabelText(/^Yeni şifre\*?$/u), "kısa")
    await userEvent.click(screen.getByRole("button", { name: "Şifreyi değiştir" }))
    expect(screen.getByText("Yeni şifre en az 10 karakter olmalı.")).toBeInTheDocument()

    await userEvent.type(screen.getByLabelText(/^Yeni şifre\*?$/u), " ve uzun parola")
    await userEvent.type(screen.getByLabelText(/^Yeni şifre \(tekrar\)/u), "başka bir şey yazdım")
    await userEvent.click(screen.getByRole("button", { name: "Şifreyi değiştir" }))
    expect(screen.getByText("İki şifre aynı değil.")).toBeInTheDocument()
    expect(posts()).toHaveLength(0)

    await userEvent.clear(screen.getByLabelText(/^Yeni şifre \(tekrar\)/u))
    await userEvent.type(screen.getByLabelText(/^Yeni şifre \(tekrar\)/u), "kısa ve uzun parola")
    await userEvent.click(screen.getByRole("button", { name: "Şifreyi değiştir" }))

    expect(posts()).toEqual([
      [
        "/admin/staff/me/password",
        {
          method: "POST",
          body: { current_password: "eski şifrem burada", new_password: "kısa ve uzun parola" },
        },
      ],
    ])
  })

  it("asks a new address with the current password, refusing one that is not an address", async () => {
    renderCard()
    await screen.findByText("elif@ornek.com")
    const emailButton = changeButton(0)
    await userEvent.click(emailButton)

    await userEvent.type(screen.getByLabelText(/^Yeni e-posta adresi/u), "elif.ornek.com")
    await userEvent.type(screen.getByLabelText(/^Mevcut şifre/u), "eski şifrem burada")
    await userEvent.click(screen.getByRole("button", { name: "Onay bağlantısı gönder" }))
    expect(screen.getByText("Geçerli bir e-posta adresi girin.")).toBeInTheDocument()
    expect(posts()).toHaveLength(0)

    await userEvent.clear(screen.getByLabelText(/^Yeni e-posta adresi/u))
    await userEvent.type(screen.getByLabelText(/^Yeni e-posta adresi/u), " Elif@Yeni.com ")
    await userEvent.click(screen.getByRole("button", { name: "Onay bağlantısı gönder" }))

    expect(posts()).toEqual([
      [
        "/admin/staff/me/email",
        {
          method: "POST",
          body: { email: "elif@yeni.com", current_password: "eski şifrem burada" },
        },
      ],
    ])
  })
})
