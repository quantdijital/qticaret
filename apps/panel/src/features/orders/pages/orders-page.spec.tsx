import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BoardOrder } from "@/features/orders/api/orders"
import type { OrderListSearch } from "@/features/orders/search"
import { OrdersPage } from "./orders-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const can = vi.hoisted(() => ({ orderExport: true }))
const search = vi.hoisted((): { current: OrderListSearch } => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => capability === "orderExport" && can.orderExport,
}))
vi.mock("@/features/payment-links/components/order-buttons", () => ({
  PaymentLinkButtons: () => null,
}))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/orders">{children}</a>,
  getRouteApi: () => ({ useSearch: () => search.current }),
  useNavigate: () => navigate,
}))

const row = (more: Partial<BoardOrder> = {}): BoardOrder => ({
  id: "order_1",
  display_id: 1042,
  created_at: "2026-11-06T09:30:00.000Z",
  currency_code: "try",
  total: "2720.00",
  items: 2,
  stage: "to_ship",
  customer: { name: "Ayşe Yılmaz", place: "İstanbul" },
  shipping: null,
  delivery: { name: "Aras Kargo", carrier: "aras", pickup: false },
  addons: { lines: 0, non_withdrawable: false },
  ...more,
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <OrdersPage />
    </QueryClientProvider>
  )
}

describe("OrdersPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    can.orderExport = true
    search.current = {}
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/order-board/export"
          ? { async_job: { id: "job_1", status: "queued" } }
          : path.startsWith("/admin/async-jobs/")
            ? { async_job: { id: "job_1", status: "failed", error_message: null } }
            : {
                orders: [
                  row({ addons: { lines: 1, non_withdrawable: true } }),
                  row({ id: "order_2", display_id: 1043 }),
                ],
                count: 2,
                counts: {
                  all: 2,
                  awaiting_payment: 0,
                  to_ship: 2,
                  shipped: 0,
                  delivered: 0,
                  canceled: 0,
                },
                offset: 0,
                limit: 20,
                limited: false,
              }
      )
    )
  })

  it("asks the server for the address's filters: the days, the method, the carrier", async () => {
    search.current = {
      stage: "to_ship",
      method: "cod",
      carrier: "aras",
      from: "2026-11-01",
      to: "2026-11-06",
    }
    renderPage()

    await screen.findByText("#1042")
    expect(fetchMock).toHaveBeenCalledWith("/admin/order-board", {
      query: {
        stage: "to_ship",
        method: "cod",
        carrier: "aras",
        from: "2026-11-01",
        to: "2026-11-06",
        offset: 0,
      },
    })
    // What is set shows as chips under the search, counted on the filter button
    expect(screen.getByRole("button", { name: "Ödeme yöntemi: Kapıda ödeme" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Kargo firması: Aras Kargo" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: /^Sipariş tarihi: / })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Filtrele · 3" })).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Tümünü temizle" }))
    expect(navigate).toHaveBeenCalledWith({
      to: "/orders",
      search: expect.objectContaining({
        stage: "to_ship",
        method: undefined,
        carrier: undefined,
        from: undefined,
        to: undefined,
      }) as unknown,
      replace: true,
    })
  })

  it("filters from the Filtrele menu into the address, from the first page", async () => {
    search.current = { stage: "to_ship", page: 3 }
    renderPage()

    await screen.findByText("#1042")
    await userEvent.click(screen.getByRole("button", { name: "Filtrele" }))
    await userEvent.click(await screen.findByRole("button", { name: /^Ödeme(?! yöntemi)/ }))
    await userEvent.click(screen.getByRole("button", { name: "İade edildi" }))
    expect(navigate).toHaveBeenLastCalledWith({
      to: "/orders",
      search: expect.objectContaining({
        stage: "to_ship",
        payment: "refunded",
        page: undefined,
      }) as unknown,
      replace: true,
    })
  })

  it("badges an order made to the buyer's wish", async () => {
    renderPage()

    expect(await screen.findByText("Kişiye özel")).toBeInTheDocument()
    expect(screen.getAllByText("Kişiye özel")).toHaveLength(1)
  })

  it("prints the picked orders' packing slips and pick list in a new tab", async () => {
    const open = vi.fn()
    vi.stubGlobal("open", open)
    renderPage()

    await screen.findByText("#1042")
    await userEvent.click(screen.getByRole("checkbox", { name: "#1042 seç" }))
    await userEvent.click(screen.getByRole("checkbox", { name: "#1043 seç" }))
    await userEvent.click(screen.getByRole("button", { name: "Paketleme fişleri" }))
    await userEvent.click(screen.getByRole("button", { name: "Toplama listesi" }))

    expect(open).toHaveBeenNthCalledWith(
      1,
      "/print/orders?kind=slip&ids=order_1%2Corder_2",
      "_blank",
      "noopener"
    )
    expect(open).toHaveBeenNthCalledWith(
      2,
      "/print/orders?kind=pick&ids=order_1%2Corder_2",
      "_blank",
      "noopener"
    )
  })

  it("exports the filtered list for the owner, and offers it to no one else", async () => {
    search.current = { stage: "to_ship", method: "card" }
    const { unmount } = renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "Dışa aktar" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Excel olarak indir" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/order-board/export", {
        method: "POST",
        body: { stage: "to_ship", method: "card", format: "xlsx" },
      })
    })
    unmount()

    can.orderExport = false
    renderPage()
    await screen.findByText("#1042")
    expect(screen.queryByRole("button", { name: "Dışa aktar" })).toBeNull()
  })

  it("says where a searched wholesale order is: they are not on this list (Ek 2026-11-15 (2))", async () => {
    search.current = { q: "1050" }
    fetchMock.mockResolvedValue({
      orders: [],
      count: 0,
      counts: { all: 0, awaiting_payment: 0, to_ship: 0, shipped: 0, delivered: 0, canceled: 0 },
      offset: 0,
      limit: 20,
      limited: false,
      wholesale_matches: 1,
    })
    renderPage()

    expect(await screen.findByText(/Aramanız 1 toptan siparişini de buldu/)).toBeInTheDocument()
    expect(screen.getByText("Toptancılar > Siparişler'de gör")).toBeInTheDocument()
    // The retail list asks for the server's default: no segment named
    expect(fetchMock).toHaveBeenCalledWith("/admin/order-board", {
      query: { stage: "all", q: "1050", offset: 0 },
    })
  })
})
