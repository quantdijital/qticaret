import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { StockReport, StockRow } from "@/features/reports/api/stock"
import { StockReportPage } from "./stock-report-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: unknown }) => children,
}))
vi.mock("@/features/reports/use-report", () => ({
  useReportRange: () => ({ period: "30d" }),
}))

const row = (over: Partial<StockRow>): StockRow => ({
  item_id: "iitem_1",
  variant_id: "variant_1",
  product_id: "prod_1",
  product_title: "Seramik Kupa",
  variant_title: "Lacivert",
  sku: "KUPA-L",
  on_hand: 76,
  cost: "85.50",
  value: "6498.00",
  sold: 4,
  start: 80,
  end: 76,
  turnover: 0.05,
  idle: false,
  ...over,
})

const report: StockReport = {
  period: { key: "30d", from: "2026-09-29T21:00:00Z", to: "2026-10-29T09:00:00Z" },
  currency_code: "try",
  capped: false,
  idle_days: 90,
  totals: {
    value: "6498.00",
    units: 80,
    costed_items: 1,
    uncosted_items: 1,
    uncosted_units: 4,
    idle_items: 0,
    idle_units: 0,
    idle_value: "0.00",
  },
  value: [row({})],
  slow: [row({})],
  idle: [],
  uncosted: [
    row({ item_id: "iitem_2", product_title: "Keten Gömlek", cost: null, value: null, on_hand: 4 }),
  ],
}

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <StockReportPage />
    </QueryClientProvider>
  )
}

describe("StockReportPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(report)
  })

  it("values the stock and switches between its lists", async () => {
    renderPage()

    expect(await screen.findByText("En değerli stok")).toBeInTheDocument()
    expect(screen.getAllByText("₺6.498,00").length).toBeGreaterThan(0)
    expect(screen.getByText("4 adet değere katılmadı")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("radio", { name: /Maliyetsiz/ }))
    expect(screen.getByText("Keten Gömlek")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("radio", { name: /Hareketsiz/ }))
    expect(screen.getByText("Hareketsiz stok yok.")).toBeInTheDocument()
  })
})
