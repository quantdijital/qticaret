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

  it("asks for the shop's customer number and password, its own app keys folded away, and says DHL eCommerce", () => {
    renderSettings(undefined)

    expect(field("dhlecommerce-customer-number")).toBeInTheDocument()
    expect(field("dhlecommerce-password")).toBeInTheDocument()
    expect(field("dhlecommerce-client-id")).not.toBeVisible()
    expect(screen.getByRole("button", { name: "Kendi uygulama anahtarlarım var" })).toHaveAttribute(
      "aria-expanded",
      "false"
    )
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

  it("sends the shop's own app keys when it opens their fields, both or neither", async () => {
    renderSettings(undefined)
    await userEvent.click(screen.getByRole("button", { name: "Kendi uygulama anahtarlarım var" }))
    await userEvent.type(field("dhlecommerce-customer-number"), "123456789")
    await userEvent.type(field("dhlecommerce-password"), "kalici-sifre")
    await userEvent.type(field("dhlecommerce-client-id"), "magaza-uygulama")
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(1)
    expect(saves()).toHaveLength(0)

    await userEvent.type(field("dhlecommerce-client-secret"), "magaza-uygulama-sirri")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/dhlecommerce", {
        method: "POST",
        body: {
          settings: { test_mode: true },
          secrets: {
            customer_number: "123456789",
            password: "kalici-sifre",
            client_id: "magaza-uygulama",
            client_secret: "magaza-uygulama-sirri",
          },
        },
      })
    })
  })

  it("shows the stored own keys open, kept when left blank", () => {
    renderSettings({
      ...connected,
      secrets: { ...connected.secrets, client_id: true, client_secret: true },
    })

    expect(field("dhlecommerce-client-id")).toBeVisible()
    expect(field("dhlecommerce-client-id").placeholder).toBe("••••••••••••")
  })

  it("without the platform's app, says so and asks for the shop's own app keys", async () => {
    renderSettings(undefined, false)

    expect(screen.getByText(/uygulama anahtarları bu sunucuda tanımlı değil/)).toBeInTheDocument()
    expect(field("dhlecommerce-client-id")).toBeVisible()
    expect(field("dhlecommerce-customer-number")).toBeEnabled()

    await userEvent.type(field("dhlecommerce-customer-number"), "123456789")
    await userEvent.type(field("dhlecommerce-password"), "kalici-sifre")
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })
})
