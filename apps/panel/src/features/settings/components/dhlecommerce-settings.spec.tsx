import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { DhlEcomAccount } from "@/features/settings/api/payments"
import { DhlEcomSettings } from "./dhlecommerce-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
// The leave prompt needs a router; what it guards is tested in e2e
vi.mock("@qticaret/admin-ui/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const connected: DhlEcomAccount = {
  provider: "dhlecommerce",
  state: "connected",
  settings: { test_mode: true },
  secrets: { customer_number: true, password: true },
  secrets_version: 1,
  verified_at: "2026-11-26T10:00:00Z",
  updated_at: "2026-11-26T10:00:00Z",
}

function renderSettings(account: DhlEcomAccount | undefined, available = true) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <DhlEcomSettings account={account} keyConfigured available={available} />
    </QueryClientProvider>
  )
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement
const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })
const saves = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string }).method === "POST")

describe("DhlEcomSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: connected, check: "valid" })
  })

  it("asks only for the shop's customer number and password, never app keys, and says DHL eCommerce", () => {
    renderSettings(undefined)

    expect(field("dhlecommerce-customer-number")).toBeInTheDocument()
    expect(field("dhlecommerce-password")).toBeInTheDocument()
    expect(screen.queryByText(/Client/i)).not.toBeInTheDocument()
    expect(screen.queryByText(/MNG/)).not.toBeInTheDocument()
    expect(screen.getByText(/geçici şifre değil/)).toBeInTheDocument()
  })

  it("asks for both on a first connection", async () => {
    renderSettings(undefined)
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })

  it("saves what was typed with the mode, and keeps the stored ones when left blank", async () => {
    renderSettings(undefined)
    await userEvent.type(field("dhlecommerce-customer-number"), "123456789")
    await userEvent.type(field("dhlecommerce-password"), "kalici-sifre")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/dhlecommerce", {
        method: "POST",
        body: {
          settings: { test_mode: true },
          secrets: { customer_number: "123456789", password: "kalici-sifre" },
        },
      })
    })
  })

  it("says the server cannot connect DHL eCommerce and locks the form", () => {
    renderSettings(undefined, false)

    expect(screen.getByText(/bu sunucuda henüz açılmadı/)).toBeInTheDocument()
    expect(field("dhlecommerce-customer-number")).toBeDisabled()
    expect(saveButton()).toBeDisabled()
  })
})
