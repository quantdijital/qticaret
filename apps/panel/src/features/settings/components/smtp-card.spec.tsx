import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { SmtpAccount } from "@/features/settings/api/payments"
import { SmtpCard } from "./smtp-card"

const fetchMock = vi.hoisted(() => vi.fn())
const staff = vi.hoisted(() => ({ accounts: true }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => capability === "accounts" && staff.accounts,
}))

const connected: SmtpAccount = {
  provider: "smtp",
  state: "connected",
  settings: {
    host: "mail.magaza.example",
    port: 587,
    security: "starttls",
    username: "bildirim@magaza.example",
    from_email: "bildirim@magaza.example",
    from_name: "Atölye",
    rate_per_minute: 30,
  },
  secrets: { password: true },
  secrets_version: 1,
  verified_at: "2026-11-10T10:00:00Z",
  updated_at: "2026-11-10T10:00:00Z",
}

const notConfigured: SmtpAccount = {
  ...connected,
  state: "not_configured",
  settings: null,
  secrets: { password: false },
}

/** The server as the card reads it: the accounts, a save, a test. */
function serve(account: SmtpAccount, test: unknown = { ok: true, to: "ah***@magaza.example" }) {
  fetchMock.mockImplementation((url: string) => {
    if (url === "/admin/integrations/credentials") {
      return Promise.resolve({ key_configured: true, accounts: [account] })
    }
    if (url === "/admin/messaging/smtp/test") {
      return Promise.resolve(test)
    }
    return Promise.resolve({ account: connected, check: "valid" })
  })
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SmtpCard />
    </QueryClientProvider>
  )
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement

describe("SmtpCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    staff.accounts = true
  })

  it("connects the owner's server: STARTTLS on 587 by default, the password written once", async () => {
    serve(notConfigured)
    renderCard()
    expect(await screen.findByText("Kendi e-posta sunucunuz bağlı değil.")).toBeInTheDocument()
    // Nothing to test before a server is saved
    expect(screen.queryByRole("button", { name: "Deneme e-postası gönder" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Sunucuyu bağla" }))

    expect(field("smtp-port").value).toBe("587")
    await userEvent.type(field("smtp-host"), "Mail.Magaza.example")
    await userEvent.type(field("smtp-username"), "bildirim@magaza.example")
    await userEvent.type(field("smtp-from-email"), "bildirim@magaza.example")
    await userEvent.click(screen.getByRole("button", { name: "Bağlan ve kaydet" }))
    // A login without its password
    expect(await screen.findByText(/Bu bilgiyi girin/)).toBeInTheDocument()

    await userEvent.type(field("smtp-password"), " gizli şifre ")
    await userEvent.click(screen.getByRole("button", { name: "Bağlan ve kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/integrations/credentials/smtp",
        expect.objectContaining({
          method: "POST",
          body: {
            settings: {
              host: "mail.magaza.example",
              port: 587,
              security: "starttls",
              username: "bildirim@magaza.example",
              from_email: "bildirim@magaza.example",
              rate_per_minute: 30,
            },
            // As typed: a password may begin or end with a space
            secrets: { password: " gizli şifre " },
          },
        })
      )
    })
  })

  it("keeps the stored password when only the pace changes", async () => {
    serve(connected)
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Düzenle" }))
    expect(field("smtp-password").value).toBe("")
    await userEvent.clear(field("smtp-rate"))
    await userEvent.type(field("smtp-rate"), "12")
    await userEvent.click(screen.getByRole("button", { name: "Bağlan ve kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/integrations/credentials/smtp",
        expect.objectContaining({
          body: { settings: expect.objectContaining({ rate_per_minute: 12 }) as unknown },
        })
      )
    })
  })

  it("asks for the password again for another port, and takes no numeric host", async () => {
    serve(connected)
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Düzenle" }))
    await userEvent.clear(field("smtp-port"))
    await userEvent.type(field("smtp-port"), "2525")
    await userEvent.clear(field("smtp-host"))
    await userEvent.type(field("smtp-host"), "2130706433")
    await userEvent.click(screen.getByRole("button", { name: "Bağlan ve kaydet" }))

    expect(await screen.findByText(/Bu bilgiyi girin/)).toBeInTheDocument()
    expect(screen.getByText(/Sunucunun tam adını/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/integrations/credentials/smtp",
      expect.anything()
    )
  })

  it("says only that the server could not be reached, whatever stopped it", async () => {
    serve(connected, { ok: false, reason: "unreachable", reply: null })
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Deneme e-postası gönder" }))
    expect(await screen.findByText(/Sunucuya ulaşılamadı/)).toBeInTheDocument()
    expect(screen.queryByText(/yanıt kodu/)).toBeNull()
  })

  it("lets an admin send a test, not change the server, and says why it failed", async () => {
    staff.accounts = false
    serve(connected, { ok: false, reason: "auth_failed", reply: "535 5.7.8" })
    renderCard()
    expect(await screen.findByText(/mail\.magaza\.example:587/)).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Düzenle" })).toBeNull()
    await userEvent.click(screen.getByRole("button", { name: "Deneme e-postası gönder" }))

    expect(
      await screen.findByText("Sunucu kullanıcı adını ya da şifreyi kabul etmedi.")
    ).toBeInTheDocument()
    expect(screen.getByText("Sunucunun yanıt kodu: 535 5.7.8")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/messaging/smtp/test", {
      method: "POST",
      body: {},
    })
  })

  it("says where the test went", async () => {
    serve(connected)
    renderCard()
    await userEvent.click(await screen.findByRole("button", { name: "Deneme e-postası gönder" }))
    expect(
      await screen.findByText(/ah\*\*\*@magaza\.example adresine gönderildi/)
    ).toBeInTheDocument()
  })

  it("shows nothing to staff who cannot read the accounts", async () => {
    fetchMock.mockRejectedValue(Object.assign(new Error("forbidden"), { status: 403 }))
    const { container } = renderCard()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalled()
    })
    await waitFor(() => {
      expect(container).toBeEmptyDOMElement()
    })
  })
})
