import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ArasAccount } from "@/features/settings/api/payments"
import { ArasSettings } from "./aras-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
// The leave prompt needs a router; what it guards is tested in e2e
vi.mock("@qticaret/admin-ui/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const connected: ArasAccount = {
  provider: "aras",
  state: "connected",
  settings: { test_mode: true, customer_code: "123456", service_url: "" },
  secrets: { username: true, password: true },
  secrets_version: 1,
  verified_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
}

function renderSettings(account: ArasAccount | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ArasSettings account={account} keyConfigured />
    </QueryClientProvider>
  )
}

const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })
const saves = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string }).method === "POST")

describe("ArasSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: connected, check: "valid" })
  })

  it("asks for the login again when going live: test and live accounts differ", async () => {
    renderSettings(connected)
    await userEvent.click(screen.getByRole("switch", { name: "Test modu" }))
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })

  it("sends a new service address with the login typed again", async () => {
    renderSettings(connected)
    const field = (id: string) => document.getElementById(id) as HTMLInputElement
    await userEvent.type(field("aras-service-url"), "https://customerws.araskargo.com.tr")
    await userEvent.type(field("aras-username"), "magaza")
    await userEvent.type(field("aras-password"), "yeni-sifre")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/aras", {
        method: "POST",
        body: {
          settings: {
            test_mode: true,
            customer_code: "123456",
            service_url: "https://customerws.araskargo.com.tr",
          },
          secrets: { username: "magaza", password: "yeni-sifre" },
        },
      })
    })
  })

  it("asks for the login again for another service address or going live", async () => {
    renderSettings(connected)
    await userEvent.type(
      document.getElementById("aras-service-url") as HTMLInputElement,
      "https://customerws.araskargo.com.tr"
    )
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })
})
