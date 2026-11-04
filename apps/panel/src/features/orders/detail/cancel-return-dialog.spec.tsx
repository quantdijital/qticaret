import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { requestCancellable } from "@/features/orders/return-rules"
import { ReturnsCard } from "./returns-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { order: { retrieve: vi.fn() } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const approved = (more: Partial<ReturnRequest> = {}): ReturnRequest => ({
  id: "rreq_1",
  order_id: "order_1",
  order_display_id: 691,
  kind: "return",
  exchange_items: null,
  difference: null,
  status: "approved",
  reason: "changed_mind",
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
  return_code: "GLV12345678",
  return_label_file_id: null,
  received_items: null,
  damaged_items: null,
  refused_items: null,
  refund_shipping: false,
  refund_amount: null,
  handed_over_at: null,
  received_at: null,
  refund_due_at: null,
  created_at: "2026-11-01T09:00:00Z",
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

/** Order #691: an approval taken back while nothing has come back. */
describe("cancelling an approved return request", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("is offered while the parcel is with the shopper and nothing was collected", () => {
    expect(requestCancellable(approved())).toBe(true)
    expect(requestCancellable(approved({ handed_over_at: "2026-11-02T09:00:00Z" }))).toBe(false)
    expect(requestCancellable(approved({ status: "requested" }))).toBe(false)
    expect(requestCancellable(approved({ kind: "exchange", difference: "120.00" }))).toBe(false)
    expect(requestCancellable(approved({ kind: "exchange", difference: "-40.00" }))).toBe(true)
  })

  it("asks why in a confirm, sends the reason and shows the request cancelled", async () => {
    const user = userEvent.setup()
    let canceled = false
    fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) => {
      if (url === "/admin/return-requests/rreq_1/cancel" && init?.method === "POST") {
        canceled = true
        return Promise.resolve({ return_request: approved({ status: "canceled" }) })
      }
      return Promise.resolve({
        return_requests: [
          canceled
            ? approved({
                status: "canceled",
                cancel_cause: "staff",
                cancel_reason: "Müşteri vazgeçti",
              })
            : approved(),
        ],
        count: 1,
      })
    })
    renderCard()

    await user.click(await screen.findByRole("button", { name: "İade talebi işlemleri" }))
    await user.click(await screen.findByRole("menuitem", { name: "İsteği iptal et" }))
    const dialog = await screen.findByRole("dialog")
    expect(dialog).toHaveTextContent("#691 iade talebi iptal edilsin mi?")
    expect(dialog).toHaveTextContent("müşteriye e-posta gider")
    const confirm = screen.getByRole("button", { name: "İsteği iptal et" })
    expect(confirm).toBeDisabled()

    await user.type(screen.getByLabelText("İptal sebebi"), "  Müşteri vazgeçti ")
    await user.click(confirm)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/cancel", {
        method: "POST",
        body: { reason: "Müşteri vazgeçti" },
      })
    })
    expect(await screen.findByText("İptal sebebi: Müşteri vazgeçti")).toBeInTheDocument()
    // The withdrawn code is no longer shown
    expect(screen.queryByText(/GLV12345678/)).not.toBeInTheDocument()
  })

  it("says a request the order's cancel closed", async () => {
    fetchMock.mockResolvedValue({
      return_requests: [approved({ status: "canceled", cancel_cause: "order_canceled" })],
      count: 1,
    })
    renderCard()

    expect(await screen.findByText("Sipariş iptal edildiği için kapandı")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "İade talebi işlemleri" })).not.toBeInTheDocument()
  })
})
