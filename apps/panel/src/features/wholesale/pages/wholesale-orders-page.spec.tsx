import { screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { BoardOrder } from "@/features/orders/api/orders"
import type { WholesaleOrderSearch } from "@/features/wholesale/search"
import { account, clientWith, renderWith } from "@/features/wholesale/wholesale.fixtures"
import { WholesaleOrdersPage } from "./wholesale-orders-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted((): { current: WholesaleOrderSearch } => ({ current: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), info: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
  getRouteApi: () => ({ useSearch: () => search.current }),
  useNavigate: () => navigate,
}))

const row: BoardOrder = {
  id: "order_9",
  display_id: 1050,
  created_at: "2026-11-15T09:30:00.000Z",
  currency_code: "try",
  total: "12000.00",
  items: 24,
  stage: "to_ship",
  customer: { name: "Ali Kaya", place: "İstanbul" },
  shipping: null,
  delivery: { name: "Aras Kargo", carrier: "aras", pickup: false },
  addons: { lines: 0, non_withdrawable: false },
  wholesaler: { id: "wsa_1", name: "Kaya Bıçak Ltd" },
}

function serve() {
  fetchMock.mockImplementation((path: string) =>
    Promise.resolve(
      path === "/admin/order-board"
        ? {
            orders: [row],
            count: 1,
            counts: {
              all: 1,
              awaiting_payment: 0,
              to_ship: 1,
              shipped: 0,
              delivered: 0,
              canceled: 0,
            },
            offset: 0,
            limit: 20,
            limited: false,
          }
        : { accounts: [account()], count: 1 }
    )
  )
}

describe("WholesaleOrdersPage (Ek 2026-11-15 (2))", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.current = {}
  })

  it("asks for the wholesale orders only, and names each one's wholesaler", async () => {
    serve()
    renderWith(clientWith(), <WholesaleOrdersPage />)
    expect(await screen.findByText("#1050")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Kaya Bıçak Ltd" })).toHaveAttribute(
      "href",
      "/customers/wholesale/$id"
    )
    expect(fetchMock).toHaveBeenCalledWith("/admin/order-board", {
      query: { stage: "all", segment: "wholesale", offset: 0 },
    })
  })

  it("narrows to one wholesaler from the picker, kept in the address", async () => {
    search.current = { wholesaler: "wsa_1", stage: "to_ship" }
    serve()
    renderWith(clientWith(), <WholesaleOrdersPage />)
    await screen.findByText("#1050")
    expect(fetchMock).toHaveBeenCalledWith("/admin/order-board", {
      query: { stage: "to_ship", segment: "wholesale", wholesaler: "wsa_1", offset: 0 },
    })
    await userEvent.click(screen.getByRole("combobox", { name: "Toptancı" }))
    await userEvent.click(await screen.findByRole("option", { name: "Tüm toptancılar" }))
    expect(navigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        to: "/customers/wholesale/orders",
        search: expect.objectContaining({ wholesaler: undefined, stage: "to_ship" }) as unknown,
      })
    )
  })

  it("is closed while the shop has wholesale off", () => {
    serve()
    renderWith(clientWith({ flag: false }), <WholesaleOrdersPage />)
    expect(screen.getByText(/Toptan satış bu mağazada kapalı/)).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/order-board", expect.anything())
  })
})
