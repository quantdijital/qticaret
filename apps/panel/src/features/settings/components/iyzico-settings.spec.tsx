import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { IyzicoAccount } from "@/features/settings/api/payments"
import { IyzicoSettings } from "./iyzico-settings"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
// The leave prompt needs a router; what it guards is tested in e2e
vi.mock("@qticaret/admin-ui/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const sandbox: IyzicoAccount = {
  provider: "iyzico",
  state: "connected",
  settings: { test_mode: true },
  secrets: { api_key: true, secret_key: true },
  secrets_version: 1,
  verified_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-27T10:00:00Z",
}

function renderSettings(account: IyzicoAccount | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <IyzicoSettings account={account} keyConfigured />
    </QueryClientProvider>
  )
}

const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })
const saves = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string }).method === "POST")

describe("IyzicoSettings", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: sandbox, check: "valid" })
  })

  it("asks for both keys on a first connection, before calling the server", async () => {
    renderSettings(undefined)
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })

  it("connects the sandbox with what was typed", async () => {
    renderSettings(undefined)
    expect(screen.getByRole("switch", { name: "Sandbox" })).toBeChecked()
    await userEvent.type(screen.getByLabelText(/API anahtarı/), "sandbox-testkey-testkey")
    await userEvent.type(screen.getByLabelText(/Gizli anahtar/), "sandbox-testsalt-testsalt")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/iyzico", {
        method: "POST",
        body: {
          settings: { test_mode: true },
          secrets: { api_key: "sandbox-testkey-testkey", secret_key: "sandbox-testsalt-testsalt" },
        },
      })
    })
  })

  it("asks for both keys again to leave the sandbox, and refuses a sandbox key there", async () => {
    renderSettings(sandbox)
    expect(screen.getAllByText(/Kayıtlı. Değiştirmek için/)).toHaveLength(2)

    await userEvent.click(screen.getByRole("switch", { name: "Sandbox" }))
    expect(screen.queryAllByText(/Kayıtlı. Değiştirmek için/)).toHaveLength(0)
    await userEvent.type(screen.getByLabelText(/API anahtarı/), "sandbox-testkey-testkey")
    await userEvent.click(saveButton())

    expect(await screen.findByText(/Bu bir sandbox anahtarı/)).toBeInTheDocument()
    expect(screen.getByText(/Bu bilgiyi girin/)).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("goes live with live keys", async () => {
    renderSettings(sandbox)
    await userEvent.click(screen.getByRole("switch", { name: "Sandbox" }))
    await userEvent.type(screen.getByLabelText(/API anahtarı/), "livekey-livekey")
    await userEvent.type(screen.getByLabelText(/Gizli anahtar/), "livesalt-livesalt")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/iyzico", {
        method: "POST",
        body: {
          settings: { test_mode: false },
          secrets: { api_key: "livekey-livekey", secret_key: "livesalt-livesalt" },
        },
      })
    })
  })

  it("shows iyzico's refusal and the notification address to paste", async () => {
    fetchMock.mockRejectedValue({ status: 400, message: "iyzico bu API anahtarını tanımadı." })
    renderSettings(undefined)
    await userEvent.type(screen.getByLabelText(/API anahtarı/), "sandbox-testkey-testkey")
    await userEvent.type(screen.getByLabelText(/Gizli anahtar/), "sandbox-testsalt-testsalt")
    await userEvent.click(saveButton())

    expect(await screen.findByRole("alert")).toHaveTextContent("iyzico bu API anahtarını tanımadı.")
    expect(screen.getByRole("textbox", { name: "Bildirim adresi" })).toHaveValue(
      `${window.location.origin}/hooks/iyzico/webhook`
    )
  })
})
