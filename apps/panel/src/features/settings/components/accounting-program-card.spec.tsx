import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { AccountingStatus } from "@/features/settings/api/accounting"
import { AccountingProgramCard } from "./accounting-program-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const status: AccountingStatus = {
  adapter: "fake",
  active: true,
  adapters: [
    { id: "none", available: true },
    { id: "fake", available: true },
  ],
  counts: { pending: 2, synced: 5, stopped: 1, skipped: 0 },
  stopped: [
    {
      id: "acsync_1",
      source_type: "sale",
      source_id: "order_1",
      attempts: 8,
      last_error: "unavailable",
      updated_at: "2026-10-29T09:00:00Z",
    },
  ],
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <AccountingProgramCard />
    </QueryClientProvider>
  )
}

describe("AccountingProgramCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_path: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "POST" ? { retried: true } : status)
    )
  })

  it("tells how the records are going, and starts a stopped one again", async () => {
    renderCard()

    expect(await screen.findByText("2 bekliyor")).toBeInTheDocument()
    expect(screen.getByText("5 aktarıldı")).toBeInTheDocument()
    expect(screen.getByText("1 durdu")).toBeInTheDocument()
    expect(screen.getByText(/8 deneme · son hata unavailable/)).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Yeniden dene" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/accounting/syncs/acsync_1/retry", {
        method: "POST",
        body: {},
      })
    })
  })
})
