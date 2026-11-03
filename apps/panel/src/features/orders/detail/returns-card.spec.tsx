import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { ReturnsCard } from "./returns-card"

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
