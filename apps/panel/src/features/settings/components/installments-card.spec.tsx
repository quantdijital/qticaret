import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { InstallmentsCard } from "./installments-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

function renderCard(values: { installments_enabled: boolean; max_installment: number }) {
  fetchMock.mockImplementation((_url: string, init?: { method?: string }) =>
    Promise.resolve(init?.method === "POST" ? { values } : { values, updated_at: null })
  )
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <InstallmentsCard />
    </QueryClientProvider>
  )
}

describe("InstallmentsCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("turns installments off at once", async () => {
    renderCard({ installments_enabled: true, max_installment: 0 })
    await userEvent.click(await screen.findByRole("switch", { name: /Taksitli ödeme/ }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/admin/platform-settings/payments",
        expect.objectContaining({ method: "POST", body: { installments_enabled: false } })
      )
    })
  })

  it("keeps the limit closed while installments are off", async () => {
    renderCard({ installments_enabled: false, max_installment: 6 })

    expect(await screen.findByRole("combobox", { name: "En çok taksit" })).toBeDisabled()
    expect(screen.getByText("6 taksit")).toBeInTheDocument()
  })
})
