import { screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { refusal, renderWithQuery, stubApi } from "@/test/api"
import type { Answer, Sent } from "@/test/api"
import { InvitePage } from "./invite-page"

const navigate = vi.hoisted(() => vi.fn())
vi.mock("@tanstack/react-router", () => ({ useNavigate: () => navigate }))

const TOKEN = "eyJhbGciOiJIUzI1NiJ9.eyJpZCI6Imludl8xIn0.c2lnbmF0dXJl"

function controlPlane(call: Sent): Answer {
  switch (call.path) {
    case "/admin/cp/invites/info":
      return { status: 200, body: { email: "yeni@quant.test", role: "finance" } }
    case "/auth/user/emailpass/register":
      return { status: 200, body: { token: "registered" } }
    case "/admin/cp/invites/accept":
      return { status: 201, body: { member: { id: "user_9", role: "finance" } } }
    case "/auth/user/emailpass":
      return { status: 200, body: { token: "signed-in" } }
    default:
      return { status: 200, body: {} }
  }
}

describe("InvitePage (adr/0061 Ek C4, L1)", () => {
  beforeEach(() => {
    navigate.mockReset()
    window.history.replaceState(null, "", `/invite#token=${TOKEN}`)
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("registers with the invitation, accepts it, signs in and leads to the 2FA setup", async () => {
    const sent = stubApi(controlPlane)
    renderWithQuery(<InvitePage />)

    expect(await screen.findByText(/yeni@quant\.test adresine Finans rolüyle/)).toBeInTheDocument()
    // The token left the address bar as soon as it was read
    expect(window.location.hash).toBe("")
    await userEvent.type(screen.getByLabelText("Ad"), "Ayşe")
    await userEvent.type(screen.getByLabelText("Soyad"), "Yılmaz")
    await userEvent.type(screen.getByLabelText("Şifre"), "uzun-bir-sifre-123")
    await userEvent.type(screen.getByLabelText("Şifre (tekrar)"), "uzun-bir-sifre-123")
    await userEvent.click(screen.getByRole("button", { name: "Hesabı oluştur" }))

    await waitFor(() => {
      expect(navigate).toHaveBeenCalledWith({ to: "/security/setup" })
    })
    expect(sent.map((call) => call.path)).toEqual([
      "/admin/cp/invites/info",
      "/auth/user/emailpass/register",
      "/admin/cp/invites/accept",
      "/auth/user/emailpass",
      "/auth/session",
    ])
    // The token in the body for the info, in `x-cp-invite` for the registration
    expect(sent[0]?.body).toEqual({ token: TOKEN })
    expect(sent[1]?.headers["x-cp-invite"]).toBe(TOKEN)
    expect(sent[2]?.headers["authorization"]).toBe("Bearer registered")
    expect(sent[2]?.body).toEqual({ token: TOKEN, first_name: "Ayşe", last_name: "Yılmaz" })
    expect(sent[4]?.headers["authorization"]).toBe("Bearer signed-in")
  })

  it("asks a long enough password, the same twice", async () => {
    const sent = stubApi(controlPlane)
    renderWithQuery(<InvitePage />)

    await userEvent.type(await screen.findByLabelText("Ad"), "Ayşe")
    await userEvent.type(screen.getByLabelText("Soyad"), "Yılmaz")
    await userEvent.type(screen.getByLabelText("Şifre"), "kisa")
    await userEvent.type(screen.getByLabelText("Şifre (tekrar)"), "baska")
    await userEvent.click(screen.getByRole("button", { name: "Hesabı oluştur" }))

    expect(await screen.findByText("Şifre en az 12 karakter olmalı.")).toBeInTheDocument()
    expect(screen.getByText("Şifreler aynı değil.")).toBeInTheDocument()
    expect(sent).toHaveLength(1)
  })

  it("says an invitation that no longer holds", async () => {
    stubApi(() => refusal(400, "cp.invite_invalid", "invalid_data"))
    renderWithQuery(<InvitePage />)

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Davet geçersiz ya da süresi dolmuş."
    )
  })
})
