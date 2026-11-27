import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { PttAccount } from "@/features/settings/api/payments"
import { PttSettings } from "./ptt-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
// The leave prompt needs a router; what it guards is tested in e2e
vi.mock("@qticaret/admin-ui/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const connected: PttAccount = {
  provider: "ptt",
  state: "connected",
  settings: { customer_id: "900123456", test_mode: true },
  secrets: { password: true },
  secrets_version: 1,
  verified_at: "2026-11-26T10:00:00Z",
  updated_at: "2026-11-26T10:00:00Z",
}

function renderSettings(account: PttAccount | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PttSettings account={account} keyConfigured />
    </QueryClientProvider>
  )
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement
const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })
const saves = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string }).method === "POST")

describe("PttSettings", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: connected, check: "valid" })
  })

  it("starts a new connection in test mode, with an example customer number", () => {
    renderSettings(undefined)

    expect(screen.getByRole("switch")).toBeChecked()
    expect(field("ptt-customer-id").placeholder).toMatch(/^Örn\./)
  })

  it("asks for a customer number of 9 or 10 digits and the password", async () => {
    renderSettings(undefined)
    await userEvent.type(field("ptt-customer-id"), "12345")
    await userEvent.click(saveButton())

    expect(await screen.findByText(/9 ya da 10 haneden/)).toBeInTheDocument()
    expect(await screen.findByText(/Bu bilgiyi girin/)).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("asks for the password again when the customer number changes", async () => {
    renderSettings(connected)
    await userEvent.clear(field("ptt-customer-id"))
    await userEvent.type(field("ptt-customer-id"), "900123457")
    await userEvent.click(saveButton())

    expect(await screen.findByText(/Bu bilgiyi girin/)).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("sends the number in the clear and only the password typed", async () => {
    renderSettings(undefined)
    await userEvent.type(field("ptt-customer-id"), "900123456")
    await userEvent.type(field("ptt-password"), "web-servis-sifresi")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/ptt", {
        method: "POST",
        body: {
          settings: { customer_id: "900123456", test_mode: true },
          secrets: { password: "web-servis-sifresi" },
        },
      })
    })
  })

  it("says why an account PTT cannot confirm shows as not verified", async () => {
    const unverified: PttAccount = { ...connected, state: "unverified", verified_at: null }
    fetchMock.mockResolvedValue({ account: unverified, check: "unconfirmed" })
    renderSettings(undefined)

    await userEvent.type(field("ptt-customer-id"), "900123456")
    await userEvent.type(field("ptt-password"), "web-servis-sifresi")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(expect.stringMatching(/doğrulanamadı/))
    })
    expect(toast.success).not.toHaveBeenCalled()
  })

  it("keeps the warning on the page while the account is not verified", () => {
    renderSettings({ ...connected, state: "unverified", verified_at: null })

    expect(screen.getByText(/reddetmeden yanıtladığı için/)).toBeInTheDocument()
  })
})
