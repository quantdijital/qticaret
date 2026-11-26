import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { SuratAccount } from "@/features/settings/api/payments"
import { SuratSettings } from "./surat-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
// The leave prompt needs a router; what it guards is tested in e2e
vi.mock("@qticaret/admin-ui/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const connected: SuratAccount = {
  provider: "surat",
  state: "connected",
  settings: {},
  secrets: { username: true, password: true, cari_code: false, web_password: false },
  secrets_version: 1,
  verified_at: "2026-11-26T10:00:00Z",
  updated_at: "2026-11-26T10:00:00Z",
}

function renderSettings(account: SuratAccount | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <SuratSettings account={account} keyConfigured />
    </QueryClientProvider>
  )
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement
const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })
const saves = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string }).method === "POST")

describe("SuratSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: connected, check: "valid" })
  })

  it("has no test mode, says whose label prints, and shows examples in the fields", () => {
    renderSettings(undefined)

    expect(screen.queryByRole("switch")).not.toBeInTheDocument()
    expect(screen.getByText(/barkod oluşturma yetkisi/)).toBeInTheDocument()
    expect(field("surat-username").placeholder).toMatch(/^Örn\./)
    expect(field("surat-cari-code").placeholder).toMatch(/^Örn\./)
  })

  it("asks for the login on a first connection, not for the cari pair", async () => {
    renderSettings(undefined)
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })

  it("asks for both parts of the cari pair once one is typed", async () => {
    renderSettings(connected)
    await userEvent.type(field("surat-cari-code"), "1234567")
    await userEvent.click(saveButton())

    expect(await screen.findByText(/Bu bilgiyi girin/)).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("adds the cari pair to a stored login, sending only what was typed", async () => {
    renderSettings(connected)
    await userEvent.type(field("surat-cari-code"), "1234567")
    await userEvent.type(field("surat-web-password"), "web-sifresi")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/surat", {
        method: "POST",
        body: { settings: {}, secrets: { cari_code: "1234567", web_password: "web-sifresi" } },
      })
    })
  })
})
