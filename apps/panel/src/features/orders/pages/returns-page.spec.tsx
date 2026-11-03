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
    },
  ],
  decision_note: null,
  return_code: null,
  return_label_file_id: null,
  received_items: null,
  damaged_items: null,
  refund_shipping: false,
  refund_amount: null,
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
            },
            {
              line_item_id: "ordli_2",
              quantity: 1,
              withdrawal_excluded: true,
              withdrawal_excluded_reason: null,
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
})
