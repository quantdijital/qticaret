import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { NoReturnsRow, ReturnsCard } from "./returns-card"

const fetchMock = vi.hoisted(() => vi.fn())
const retrieveMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { order: { retrieve: retrieveMock } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const DAY = 24 * 60 * 60 * 1000

const request = (more: Partial<ReturnRequest>): ReturnRequest => ({
  id: "rreq_1",
  order_id: "order_1",
  order_display_id: 1042,
  kind: "return",
  exchange_items: null,
  difference: null,
  status: "received",
  reason: "changed_mind",
  note: null,
  items: [
    {
      line_item_id: "ordli_1",
      quantity: 2,
      withdrawal_excluded: false,
      withdrawal_excluded_reason: null,
      withdrawal_warning: "sealed_goods",
    },
  ],
  decision_note: null,
  return_code: null,
  return_label_file_id: null,
  received_items: [{ line_item_id: "ordli_1", quantity: 1 }],
  damaged_items: [],
  refused_items: [{ line_item_id: "ordli_1", quantity: 1, reason: "unsealed" }],
  refund_shipping: true,
  refund_amount: null,
  handed_over_at: "2026-11-01T09:00:00Z",
  received_at: "2026-11-03T09:00:00Z",
  refund_due_at: new Date(Date.now() + 3 * DAY).toISOString(),
  created_at: "2026-10-30T09:00:00Z",
  ...more,
})

const renderCard = () =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <ReturnsCard orderId="order_1" />
    </QueryClientProvider>
  )

describe("ReturnsCard on the order (adr/0032 Ek 2026-11-03)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    retrieveMock.mockReset()
    retrieveMock.mockResolvedValue({ order: { items: [{ id: "ordli_1", title: "Diş fırçası" }] } })
  })

  it("names the refused units, the handover and the last day, red near it", async () => {
    fetchMock.mockResolvedValue({ return_requests: [request({})], count: 1 })
    renderCard()

    expect(
      await screen.findByText("Reddedildi (ambalajı açılmış): Diş fırçası × 1")
    ).toBeInTheDocument()
    expect(screen.getByText("Kargoya teslim: 1 Kas 2026")).toBeInTheDocument()
    expect(screen.getByText(/^Yasal son gün: .+ \(3 gün kaldı\)$/)).toHaveClass(
      "text-destructive-text"
    )
    expect(screen.getByText("Mühürlü ürün: açıldıysa iade edilmez")).toBeInTheDocument()
  })

  it("reads the order's lines only when a unit was refused", async () => {
    fetchMock.mockResolvedValue({
      return_requests: [request({ refused_items: null, status: "approved" })],
      count: 1,
    })
    renderCard()

    expect(await screen.findByText(/^Yasal son gün: /)).toBeInTheDocument()
    expect(retrieveMock).not.toHaveBeenCalled()
  })
})

describe("NoReturnsRow (docs/06 Detay sayfası düzeni)", () => {
  const renderRow = (returnable: { window_open: boolean; returnable: number }) => {
    fetchMock.mockImplementation((url: string) =>
      Promise.resolve(
        url === "/admin/staff/me"
          ? { role: "owner", can: { orders: true } }
          : {
              window_open: returnable.window_open,
              open_request: false,
              lines: [
                {
                  line_item_id: "ordli_1",
                  title: "Diş fırçası",
                  variant_title: null,
                  variant_id: "variant_1",
                  returnable: returnable.returnable,
                  withdrawal_excluded: false,
                  withdrawal_excluded_reason: null,
                  withdrawal_warning: null,
                  gift_card: false,
                  variants: [],
                },
              ],
            }
      )
    )
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <NoReturnsRow orderId="order_1" />
      </QueryClientProvider>
    )
  }

  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("says there is none, with the way to open one for the shopper who called", async () => {
    renderRow({ window_open: true, returnable: 1 })

    expect(screen.getByText("Bu siparişte iade ya da değişim talebi yok.")).toBeInTheDocument()
    expect(
      await screen.findByRole("button", { name: "İade ya da değişim talebi aç" })
    ).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/returnable")
  })

  it("offers no request once the window has closed", async () => {
    renderRow({ window_open: false, returnable: 1 })

    expect(screen.getByText("Bu siparişte iade ya da değişim talebi yok.")).toBeInTheDocument()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/returnable")
    })
    // Both answers read: still no way to open one
    await new Promise((resolve) => setTimeout(resolve, 20))
    expect(screen.queryByRole("button", { name: "İade ya da değişim talebi aç" })).toBeNull()
  })
})
