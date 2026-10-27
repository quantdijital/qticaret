import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { GeliverAccount } from "@/features/settings/api/payments"
import { GeliverSettings } from "./geliver-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
// The leave prompt needs a router; what it guards is tested in e2e
vi.mock("@/components/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const connected: GeliverAccount = {
  provider: "geliver",
  state: "connected",
  settings: { test_mode: true },
  secrets: { api_token: true },
  secrets_version: 1,
  verified_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
}

function renderSettings(account: GeliverAccount | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <GeliverSettings account={account} keyConfigured />
    </QueryClientProvider>
  )
}

const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })
const saves = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string }).method === "POST")

describe("GeliverSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: connected, check: "valid" })
  })

  it("asks for the token on a first connection, before calling the server", async () => {
    renderSettings(undefined)
    await userEvent.click(saveButton())

    expect(await screen.findByText(/Bu bilgiyi girin/)).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("connects with test shipments on, sending what was typed", async () => {
    renderSettings(undefined)
    expect(screen.getByRole("switch", { name: "Test gönderileri" })).toBeChecked()
    await userEvent.type(screen.getByLabelText(/API anahtarı/), "gelistirme-deneme-anahtari")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/geliver", {
        method: "POST",
        body: {
          settings: { test_mode: true },
          secrets: { api_token: "gelistirme-deneme-anahtari" },
        },
      })
    })
  })

  it("goes live with the stored token: nothing is asked again", async () => {
    renderSettings(connected)
    expect(screen.getByText(/Kayıtlı. Değiştirmek için/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("switch", { name: "Test gönderileri" }))
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/geliver", {
        method: "POST",
        body: { settings: { test_mode: false } },
      })
    })
  })
})
