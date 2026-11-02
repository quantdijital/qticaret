import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { StatementChecks } from "@/features/reports/api/statements"
import { StatementChecksCard } from "./statement-checks-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}))
vi.mock("@/features/reports/use-report", () => ({
  useReportRange: () => ({ from: "2026-10-27", to: "2026-10-28" }),
}))

const checks: StatementChecks = {
  providers: [
    { provider: "paytr", connected: true, test_mode: false },
    { provider: "iyzico", connected: true, test_mode: true },
  ],
  checks: [
    {
      provider: "paytr",
      day: "2026-10-28",
      status: "mismatched",
      matched: 4,
      sales: 5,
      error_code: null,
      checked_at: "2026-10-29T05:30:00Z",
      issues: [
        {
          kind: "missing_at_provider",
          reference: "paysesA1",
          order_id: "order_1",
          display_id: 214,
          shop: "210.00",
          provider: "0.00",
        },
      ],
    },
    {
      provider: "paytr",
      day: "2026-10-27",
      status: "matched",
      matched: 3,
      sales: 3,
      error_code: null,
      checked_at: "2026-10-28T05:30:00Z",
      issues: [],
    },
  ],
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StatementChecksCard currencyCode="try" />
    </QueryClientProvider>
  )
}

describe("StatementChecksCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((_path: string, init?: { method?: string }) =>
      Promise.resolve(init?.method === "POST" ? { check: checks.checks[1] } : checks)
    )
  })

  it("tells each provider's days and lists what differs on a day", async () => {
    renderCard()

    expect(
      await screen.findByText("1 gün tuttu · 1 gün fark · 0 gün okunamadı")
    ).toBeInTheDocument()
    expect(screen.getByText("Test modu")).toBeInTheDocument()
    expect(screen.getByText(/28\.10\.2026/)).toBeInTheDocument()
    expect(screen.getByText("Sağlayıcıda yok")).toBeInTheDocument()
    // Under the difference on a phone, in its own column on a wider screen
    expect(screen.getAllByText("#214")).toHaveLength(2)
    expect(screen.getByText("paysesA1")).toBeInTheDocument()
  })

  it("checks a day again on request", async () => {
    renderCard()

    await userEvent.click(await screen.findByRole("button", { name: "Yeniden denetle" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/reports/statements", {
        method: "POST",
        body: { provider: "paytr", day: "2026-10-28" },
      })
    })
  })
})
