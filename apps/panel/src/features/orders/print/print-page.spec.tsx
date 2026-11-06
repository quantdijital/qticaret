import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { idsOf } from "./open-print"
import { PrintOrdersPage } from "./print-page"
import { item, order, slips } from "./print.fixtures"

const fetchMock = vi.hoisted(() => vi.fn())
const search = vi.hoisted((): { current: { kind?: "slip" | "pick"; ids?: string } } => ({
  current: {},
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  getRouteApi: () => ({ useSearch: () => search.current }),
}))

const ENGRAVED = order({
  items: [
    item({
      quantity: 2,
      addons: [
        { label: "Ürün üzerine yazı", value: "Ahmet & Ayşe 2026", kind: "text" },
        { label: "Kılıf", value: "Desenli Siyah", kind: "choice" },
      ],
      non_withdrawable: true,
    }),
    item({
      id: "ordli_2",
      title: "Hediye kartı",
      variant: null,
      sku: null,
      ships: false,
      gift: { recipient: "Mehmet", message: "İyi ki doğdun", sender: "Ayşe" },
    }),
  ],
  notes: ["Hediye paketi yapılacak"],
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <PrintOrdersPage />
    </QueryClientProvider>
  )
}

describe("PrintOrdersPage", () => {
  const print = vi.fn()

  beforeEach(() => {
    fetchMock.mockReset()
    print.mockReset()
    vi.stubGlobal("print", print)
    search.current = { kind: "slip", ids: "order_1" }
  })

  it("prints a slip with each add-on's full text, a gift's note, no prices, and prints itself", async () => {
    fetchMock.mockResolvedValue(slips([ENGRAVED]))
    renderPage()

    const slip = await screen.findByRole("region", { name: "#1042 paketleme fişi" })
    expect(fetchMock).toHaveBeenCalledWith("/admin/packing-slips", { query: { ids: "order_1" } })
    expect(within(slip).getByText("Ahmet & Ayşe 2026")).toBeInTheDocument()
    expect(within(slip).getByText("Desenli Siyah")).toBeInTheDocument()
    expect(within(slip).getByText("Kişiye özel ürün")).toBeInTheDocument()
    expect(within(slip).getByText(/Hediye: Mehmet · “İyi ki doğdun”/)).toBeInTheDocument()
    expect(within(slip).getByText("Ödeme: Kapıda ödeme")).toBeInTheDocument()
    expect(within(slip).getByText("SEF-20")).toBeInTheDocument()
    expect(within(slip).queryByText("Birim fiyat")).toBeNull()
    // The team's notes are never the shopper's: off unless asked for this print
    expect(within(slip).queryByText("Hediye paketi yapılacak")).toBeNull()
    await waitFor(() => {
      expect(print).toHaveBeenCalledTimes(1)
    })

    await userEvent.click(screen.getByRole("checkbox", { name: "Ekip notlarını ekle" }))
    expect(within(slip).getByText("Hediye paketi yapılacak")).toBeInTheDocument()
  })

  it("prints prices and totals when the shop asks for them", async () => {
    fetchMock.mockResolvedValue(
      slips(
        [
          order({
            items: [item({ quantity: 2, unit_price: "1335.00", total: "2670.00" })],
            totals: { items: "2670.00", shipping: "50.00", discount: "0.00", total: "2720.00" },
          }),
        ],
        true
      )
    )
    renderPage()

    const slip = await screen.findByRole("region", { name: "#1042 paketleme fişi" })
    expect(within(slip).getByText("Birim fiyat")).toBeInTheDocument()
    expect(within(slip).getByText("₺2.720,00")).toBeInTheDocument()
  })

  it("prints one pick list of the orders, each order's add-on text under its product", async () => {
    search.current = { kind: "pick", ids: "order_1,order_2" }
    fetchMock.mockResolvedValue(
      slips([ENGRAVED, order({ id: "order_2", display_id: 1043, items: [item({ quantity: 3 })] })])
    )
    renderPage()

    const sheet = await screen.findByRole("region", { name: "Toplama listesi" })
    const row = within(sheet).getByText("Şef Bıçağı").closest("tr")
    expect(row).not.toBeNull()
    expect(within(row as HTMLElement).getByText("5")).toBeInTheDocument()
    expect(within(row as HTMLElement).getByText("Ahmet & Ayşe 2026")).toBeInTheDocument()
    expect(within(sheet).queryByText("Hediye kartı")).toBeNull()
    // The pick list is the team's own paper: their notes on it
    expect(within(sheet).getByText(/Hediye paketi yapılacak/)).toBeInTheDocument()
  })

  it("takes order ids only from the address, each once", () => {
    expect(idsOf("order_1,order_1,cus_2,,order_3")).toEqual(["order_1", "order_3"])
    expect(idsOf(undefined)).toEqual([])
  })
})
