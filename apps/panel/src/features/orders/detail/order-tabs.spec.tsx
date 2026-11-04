import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ShopRefund } from "@/features/orders/api/payments"
import { OrderTabs } from "./order-tabs"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  useSearch: () => ({}),
  useNavigate: () => vi.fn(),
}))

const message = (id: string, template: string) => ({
  id,
  template,
  channel: "email",
  state: "sent",
  reason: null,
  to: "ay***@example.com",
  at: "2026-11-03T10:00:00Z",
})

const CHARGEBACK = {
  id: "cb_1",
  order_id: "order_1",
  order_display_id: 691,
  provider: "pp_paytr",
  provider_reference: null,
  amount: "374.30",
  currency_code: "try",
  reason: "not_received",
  status: "won",
  due_at: null,
  note: null,
  created_at: "2026-11-03T10:00:00Z",
  closed_at: "2026-11-04T10:00:00Z",
}

const REFUND: ShopRefund = {
  reference: "ref_1",
  amount: "100.00",
  status: "done",
  note: null,
  created_at: "2026-11-03T12:00:00Z",
}

function answer({ chargebacks }: { chargebacks: unknown[] }) {
  fetchMock.mockImplementation((url: string) =>
    Promise.resolve(
      url === "/admin/orders/order_1/messages"
        ? {
            messages: [
              message("m1", "return.approved"),
              message("m2", "return.requested"),
              message("m3", "order.shipped"),
              message("m4", "order.placed"),
            ],
            limited: false,
          }
        : url === "/admin/chargebacks"
          ? { chargebacks, count: chargebacks.length }
          : url === "/admin/staff/me"
            ? { role: "owner", can: { orders: true } }
            : { window_open: false, open_request: false, lines: [] }
    )
  )
}

function renderTabs(props: { hasReturns: boolean | undefined; refunds: ShopRefund[] }) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <OrderTabs orderId="order_1" currency="try" {...props} />
    </QueryClientProvider>
  )
}

describe("OrderTabs (docs/06 Detay sayfası düzeni)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("opens on the message timeline, with a row for no return and no empty tabs", async () => {
    answer({ chargebacks: [] })
    renderTabs({ hasReturns: false, refunds: [] })

    expect(await screen.findByRole("tab", { name: "İletişim geçmişi 4" })).toHaveAttribute(
      "aria-selected",
      "true"
    )
    // The newest three, the rest on request
    expect(await screen.findByRole("button", { name: "Tümünü göster (4)" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "İade ve değişim" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Sözleşme onayı" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: /Para iadeleri/ })).toBeNull()
    expect(screen.queryByRole("tab", { name: /Ters ibraz/ })).toBeNull()
  })

  it("names the refunds and disputes it holds; a request's card is the page's, not a tab", async () => {
    answer({ chargebacks: [CHARGEBACK] })
    renderTabs({ hasReturns: true, refunds: [REFUND] })

    expect(await screen.findByRole("tab", { name: "Ters ibraz 1" })).toBeInTheDocument()
    expect(screen.getByRole("tab", { name: "Para iadeleri 1" })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "İade ve değişim" })).toBeNull()
  })

  it("waits for the requests before offering the no-return row", async () => {
    answer({ chargebacks: [] })
    renderTabs({ hasReturns: undefined, refunds: [] })

    expect(await screen.findByRole("tab", { name: /İletişim geçmişi/ })).toBeInTheDocument()
    expect(screen.queryByRole("tab", { name: "İade ve değişim" })).toBeNull()
  })
})
