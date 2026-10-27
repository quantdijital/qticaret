import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProviderAccount } from "@/features/settings/api/payments"
import { PaytrCard } from "./paytr-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))
// The leave prompt needs a router; what it guards is tested in e2e
vi.mock("@/components/patterns/leave-guard", () => ({ LeaveGuard: () => null }))

const connected: ProviderAccount = {
  provider: "paytr",
  state: "connected",
  settings: { merchant_id: "100001", test_mode: true },
  secrets: { merchant_key: true, merchant_salt: true },
  secrets_version: 1,
  verified_at: "2026-10-27T10:00:00Z",
  updated_at: "2026-10-27T10:00:00Z",
}

function renderCard(account: ProviderAccount | undefined) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PaytrCard account={account} keyConfigured />
    </QueryClientProvider>
  )
}

const saveButton = () => screen.getByRole("button", { name: "Kaydet ve doğrula" })
const saves = () =>
  fetchMock.mock.calls.filter(([, init]) => (init as { method?: string }).method === "POST")

describe("PaytrCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ account: connected, check: "valid" })
  })

  it("asks for both secrets on a first connection, before calling the server", async () => {
    renderCard(undefined)
    await userEvent.type(screen.getByLabelText(/Mağaza no/), "100001")
    await userEvent.click(saveButton())

    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })

  it("connects in test mode with what was typed", async () => {
    renderCard(undefined)
    await userEvent.type(screen.getByLabelText(/Mağaza no/), " 100001 ")
    await userEvent.type(screen.getByLabelText(/Mağaza parola/), "testkey-testkey")
    await userEvent.type(screen.getByLabelText(/Mağaza gizli anahtar/), "testsalt-testsalt")
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/paytr", {
        method: "POST",
        body: {
          settings: { merchant_id: "100001", test_mode: true },
          secrets: { merchant_key: "testkey-testkey", merchant_salt: "testsalt-testsalt" },
        },
      })
    })
  })

  it("keeps stored secrets left blank, and asks for them again for a new shop number", async () => {
    renderCard(connected)
    expect(saveButton()).toBeDisabled()
    expect(screen.getAllByText(/Kayıtlı. Değiştirmek için/)).toHaveLength(2)

    await userEvent.clear(screen.getByLabelText(/Mağaza no/))
    await userEvent.type(screen.getByLabelText(/Mağaza no/), "100002")

    expect(screen.queryAllByText(/Kayıtlı. Değiştirmek için/)).toHaveLength(0)
    expect(screen.getByRole("button", { name: "Bağlantıyı test et" })).toBeDisabled()
    await userEvent.click(saveButton())
    expect(await screen.findAllByText(/Bu bilgiyi girin/)).toHaveLength(2)
    expect(saves()).toHaveLength(0)
  })

  it("sends only the changed setting when no secret is typed", async () => {
    renderCard(connected)
    await userEvent.click(screen.getByRole("switch", { name: "Test modu" }))
    await userEvent.click(saveButton())

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/integrations/credentials/paytr", {
        method: "POST",
        body: { settings: { merchant_id: "100001", test_mode: false } },
      })
    })
  })

  it("shows why PayTR refused and keeps what was typed", async () => {
    fetchMock.mockRejectedValue({ status: 400, message: "PayTR bu mağaza numarasını tanımadı." })
    renderCard(undefined)
    await userEvent.type(screen.getByLabelText(/Mağaza no/), "999999")
    await userEvent.type(screen.getByLabelText(/Mağaza parola/), "testkey-testkey")
    await userEvent.type(screen.getByLabelText(/Mağaza gizli anahtar/), "testsalt-testsalt")
    await userEvent.click(saveButton())

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "PayTR bu mağaza numarasını tanımadı."
    )
    expect(screen.getByLabelText(/Mağaza no/)).toHaveValue("999999")
    expect(screen.getByLabelText(/Mağaza parola/)).toHaveValue("testkey-testkey")
  })

  it("refuses a secret PayTR could not have issued without calling the server", async () => {
    renderCard(undefined)
    await userEvent.type(screen.getByLabelText(/Mağaza no/), "100001")
    await userEvent.type(screen.getByLabelText(/Mağaza parola/), "with spaces in it")
    await userEvent.type(screen.getByLabelText(/Mağaza gizli anahtar/), "testsalt-testsalt")
    await userEvent.click(saveButton())

    expect(await screen.findByText(/8–128 karakter olmalı/)).toBeInTheDocument()
    expect(saves()).toHaveLength(0)
  })

  it("says plainly when PayTR refuses the stored details", () => {
    renderCard({ ...connected, state: "rejected" })

    expect(screen.getByText("PayTR reddetti")).toBeInTheDocument()
    expect(screen.getByText(/artık kabul etmiyor/)).toBeInTheDocument()
  })
})
