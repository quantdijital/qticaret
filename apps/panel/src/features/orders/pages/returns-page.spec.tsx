import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { ReturnsPage } from "./returns-page"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/orders/order_1">{children}</a>,
  getRouteApi: () => ({ useSearch: () => ({}) }),
  useNavigate: () => vi.fn(),
}))

const request = (more: Partial<ReturnRequest>): ReturnRequest => ({
  id: "rreq_1",
  order_id: "order_1",
  order_display_id: 1042,
  kind: "return",
  exchange_items: null,
  difference: null,
  status: "requested",
  reason: "damaged",
  note: null,
  items: [
    {
      line_item_id: "ordli_1",
      quantity: 1,
      withdrawal_excluded: false,
      withdrawal_excluded_reason: null,
      withdrawal_warning: null,
    },
  ],
  decision_note: null,
  return_code: null,
  return_label_file_id: null,
  received_items: null,
  damaged_items: null,
  refund_shipping: false,
  refund_amount: null,
  refused_items: null,
  handed_over_at: null,
  received_at: null,
  refund_due_at: null,
  created_at: "2026-11-02T09:00:00Z",
  ...more,
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <ReturnsPage />
    </QueryClientProvider>
  )
}

const rowOf = (number: number) => {
  const row = screen.getByText(`#${String(number)}`).closest("tr")
  if (!row) {
    throw new Error(`No row for #${String(number)}`)
  }
  return within(row)
}

describe("ReturnsPage (F7.9, adr/0032)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({
      return_requests: [
        request({
          id: "rreq_1",
          order_display_id: 1042,
          items: [
            {
              line_item_id: "ordli_1",
              quantity: 1,
              withdrawal_excluded: false,
              withdrawal_excluded_reason: null,
              withdrawal_warning: null,
            },
            {
              line_item_id: "ordli_2",
              quantity: 1,
              withdrawal_excluded: true,
              withdrawal_excluded_reason: null,
              withdrawal_warning: null,
            },
          ],
        }),
        request({ id: "rreq_2", order_id: "order_2", order_display_id: 1043 }),
      ],
      count: 2,
    })
  })

  it("marks a request with a line outside the right of withdrawal, from its own items", async () => {
    renderPage()

    expect(await screen.findByText("#1042")).toBeInTheDocument()
    expect(rowOf(1042).getByText("Cayma dışı")).toBeInTheDocument()
    expect(rowOf(1043).queryByText("Cayma dışı")).toBeNull()
    // The queue's own list carries the mark: no order is read for it
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests", {
      query: { status: "requested", limit: 50, offset: 0 },
    })
  })

  it("says why a request's line is outside the right of withdrawal", async () => {
    fetchMock.mockResolvedValue({
      return_requests: [
        request({
          items: [
            {
              line_item_id: "ordli_3",
              quantity: 1,
              withdrawal_excluded: true,
              withdrawal_excluded_reason: "gift_card_used",
              withdrawal_warning: null,
            },
          ],
        }),
        request({
          id: "rreq_2",
          order_id: "order_2",
          order_display_id: 1043,
          items: [
            {
              line_item_id: "ordli_4",
              quantity: 1,
              withdrawal_excluded: true,
              withdrawal_excluded_reason: "personal_addon",
              withdrawal_warning: null,
            },
          ],
        }),
      ],
      count: 2,
    })
    renderPage()

    expect(await screen.findByText("#1042")).toBeInTheDocument()
    expect(rowOf(1042).getByText("Cayma dışı · kart kullanıldı")).toBeInTheDocument()
    expect(rowOf(1043).getByText("Cayma dışı · kişiye özel")).toBeInTheDocument()
  })

  it("says the law's clock, refused units and sealed goods, offering no refund when all was refused", async () => {
    const DAY = 24 * 60 * 60 * 1000
    const inDays = (days: number) =>
      new Date(Date.now() + days * DAY - 60 * 60 * 1000).toISOString()
    const refused = [{ line_item_id: "ordli_1", quantity: 1, reason: "unsealed" as const }]
    fetchMock.mockResolvedValue({
      return_requests: [
        // On its way, handed over: the last day far off
        request({
          status: "approved",
          handed_over_at: "2026-11-01T09:00:00Z",
          refund_due_at: inDays(10),
          items: [
            {
              line_item_id: "ordli_1",
              quantity: 1,
              withdrawal_excluded: false,
              withdrawal_excluded_reason: null,
              withdrawal_warning: "sealed_goods",
            },
          ],
        }),
        // Received and not yet refunded: two days left
        request({
          id: "rreq_2",
          order_display_id: 1043,
          status: "received",
          received_items: [{ line_item_id: "ordli_1", quantity: 1 }],
          refund_due_at: inDays(2),
        }),
        // Past the last day
        request({
          id: "rreq_3",
          order_display_id: 1044,
          status: "approved",
          refund_due_at: inDays(-1),
        }),
        // Refunded: the day no longer matters
        request({
          id: "rreq_4",
          order_display_id: 1045,
          status: "refunded",
          refund_due_at: inDays(-3),
        }),
        // Every unit refused at receipt: nothing to refund
        request({
          id: "rreq_5",
          order_display_id: 1046,
          status: "received",
          received_items: [],
          damaged_items: [],
          refused_items: refused,
          refund_due_at: inDays(5),
        }),
      ],
      count: 5,
    })
    renderPage()

    expect(await screen.findByText("#1042")).toBeInTheDocument()
    expect(rowOf(1042).getByText("Kargoya teslim: 1 Kas 2026")).toBeInTheDocument()
    expect(rowOf(1042).getByText("Mühürlü ürün: açıldıysa iade edilmez")).toBeInTheDocument()
    const far = rowOf(1042).getByText(/^Yasal son gün: /)
    expect(far).toHaveAttribute("data-state", "open")
    expect(far).not.toHaveClass("text-destructive-text")

    const near = rowOf(1043).getByText(/^Yasal son gün: .+ \(2 gün kaldı\)$/)
    expect(near).toHaveClass("text-destructive-text")
    expect(rowOf(1043).queryByText("Mühürlü ürün: açıldıysa iade edilmez")).toBeNull()
    const late = rowOf(1044).getByText(/^Yasal son gün geçti: /)
    expect(late).toHaveClass("text-destructive-text")
    expect(rowOf(1045).queryByText(/Yasal son gün/)).toBeNull()

    expect(rowOf(1046).getByText("Reddedildi (ambalajı açılmış): 1 adet")).toBeInTheDocument()
    expect(rowOf(1046).queryByText(/Yasal son gün/)).toBeNull()
    // Received with something taken back still offers the refund again; all refused, nothing
    expect(rowOf(1043).getByRole("button", { name: "İade talebi işlemleri" })).toBeInTheDocument()
    expect(rowOf(1046).queryByRole("button", { name: "İade talebi işlemleri" })).toBeNull()
  })
})
