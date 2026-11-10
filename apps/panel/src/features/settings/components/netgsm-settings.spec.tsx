import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { NetgsmAccount } from "@/features/settings/api/payments"
import { NetgsmSettings } from "./netgsm-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
vi.mock("@qticaret/admin-ui/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const connected: NetgsmAccount = {
  provider: "netgsm",
  state: "connected",
  settings: { msgheader: "MAGAZA" },
  secrets: { usercode: true, password: true },
  secrets_version: 1,
  verified_at: "2026-10-28T10:00:00Z",
  updated_at: "2026-10-28T10:00:00Z",
}

function renderSettings(account: NetgsmAccount | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NetgsmSettings account={account} keyConfigured />
    </QueryClientProvider>
  )
}

const field = (id: string) => document.getElementById(id) as HTMLInputElement
const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })

describe("NetgsmSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: connected, check: "valid" })
  })

  it("asks for the login and a sender name on a first connection", async () => {
    renderSettings(undefined)
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(fetchMock).not.toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ method: "POST" })
    )
  })

  it("changes the sender name alone, keeping the stored login", async () => {
    renderSettings(connected)
    await userEvent.clear(field("netgsm-msgheader"))
    await userEvent.type(field("netgsm-msgheader"), "YENIBASLIK")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/netgsm", {
        method: "POST",
        body: { settings: { msgheader: "YENIBASLIK" } },
      })
    })
  })

  it("adds the İYS brand code, and takes digits only", async () => {
    renderSettings(connected)
    await userEvent.type(field("netgsm-iys-brand-code"), "MARKA1")
    await userEvent.click(saveButton())
    expect(await screen.findByText(/yalnızca rakam/)).toBeInTheDocument()

    await userEvent.clear(field("netgsm-iys-brand-code"))
    await userEvent.type(field("netgsm-iys-brand-code"), "654321")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/netgsm", {
        method: "POST",
        body: { settings: { msgheader: "MAGAZA", iys_brand_code: "654321" } },
      })
    })
  })
})
