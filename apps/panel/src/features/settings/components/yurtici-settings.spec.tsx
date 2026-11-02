import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { YurticiAccount } from "@/features/settings/api/payments"
import { YurticiSettings } from "./yurtici-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
// The leave prompt needs a router; what it guards is tested in e2e
vi.mock("@/components/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const connected: YurticiAccount = {
  provider: "yurtici",
  state: "connected",
  settings: { test_mode: true },
  secrets: { username: true, password: true, cod_username: false, cod_password: false },
  secrets_version: 1,
  verified_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
}

function renderSettings(account: YurticiAccount | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <YurticiSettings account={account} keyConfigured />
    </QueryClientProvider>
  )
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement
const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })
const saves = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string }).method === "POST")

describe("YurticiSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: connected, check: "valid" })
  })

  it("names which of Yurtiçi's users each login is, and the tracking pace", () => {
    renderSettings(undefined)

    expect(screen.getByText(/“Gönderici Ödemeli” kullanıcısını girin/)).toBeInTheDocument()
    expect(screen.getByText(/dakikada bir izin verir/)).toBeInTheDocument()
    expect(
      screen.getByText(/“Gönderici Ödemeli Tahsilatlı Teslimat” kullanıcısını girin/)
    ).toBeInTheDocument()
  })

  it("asks for the login on a first connection, not for the door account", async () => {
    renderSettings(undefined)
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })

  it("asks for both parts of the door account once one is typed", async () => {
    renderSettings(connected)
    await userEvent.type(field("yurtici-cod-username"), "tahsilat-kullanici")
    await userEvent.click(saveButton())

    expect(await screen.findByText(/Bu bilgiyi girin/)).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("adds the door account to a stored login, sending only what was typed", async () => {
    renderSettings(connected)
    await userEvent.type(field("yurtici-cod-username"), "tahsilat-kullanici")
    await userEvent.type(field("yurtici-cod-password"), "tahsilat-sifresi")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/yurtici", {
        method: "POST",
        body: {
          settings: { test_mode: true },
          secrets: { cod_username: "tahsilat-kullanici", cod_password: "tahsilat-sifresi" },
        },
      })
    })
  })

  it("asks for the login again when going live: test and live accounts differ", async () => {
    renderSettings(connected)
    await userEvent.click(screen.getByRole("switch", { name: "Test modu" }))
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })
})
