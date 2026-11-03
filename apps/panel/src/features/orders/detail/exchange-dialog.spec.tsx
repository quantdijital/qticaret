import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { ApproveExchangeDialog } from "./exchange-dialog"

const fetchMock = vi.hoisted(() => vi.fn())
const retrieveMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { order: { retrieve: retrieveMock } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() } }))

const request: ReturnRequest = {
  id: "rreq_1",
  order_id: "order_1",
  order_display_id: 1042,
  kind: "exchange",
  exchange_items: [{ line_item_id: "ordli_1", variant_id: "variant_xl", quantity: 1, title: "XL" }],
  difference: "50.00",
  status: "requested",
  reason: "size_issue",
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
  created_at: "2026-10-28T09:00:00Z",
}

const open = (shown: ReturnRequest) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ApproveExchangeDialog request={shown} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

describe("ApproveExchangeDialog (adr/0032 §6)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({})
    retrieveMock.mockResolvedValue({
      order: { items: [{ id: "ordli_1", title: "Gömlek", variant_title: "M" }] },
    })
  })

  it("approves a dearer swap only once staff say they collected the difference", async () => {
    open(request)

    expect(await screen.findByText("M yerine XL")).toBeInTheDocument()
    expect(screen.getByText(/Müşteri .*50,00.* ödeyecek/)).toBeInTheDocument()
    const approve = screen.getByRole("button", { name: "Onayla" })
    expect(approve).toBeDisabled()

    await userEvent.click(screen.getByRole("checkbox", { name: /Farkı müşteriden aldım/ }))
    await userEvent.click(approve)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/approve", {
        method: "POST",
        body: { difference_collected: true },
      })
    })
  })

  it("approves a swap at the same price straight away", async () => {
    open({ ...request, difference: "0.00" })

    expect(await screen.findByText("Fark yok")).toBeInTheDocument()
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Onayla" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/approve", {
        method: "POST",
        body: { difference_collected: false },
      })
    })
  })

  it("marks a line the request carries as outside the right of withdrawal", async () => {
    open({
      ...request,
      items: [
        {
          line_item_id: "ordli_1",
          quantity: 1,
          withdrawal_excluded: true,
          withdrawal_excluded_reason: null,
          withdrawal_warning: null,
        },
      ],
    })

    expect(await screen.findByText("M yerine XL")).toBeInTheDocument()
    expect(screen.getByText("Cayma dışı").closest("li")).toHaveTextContent("Gömlek × 1")
  })

  it("shows no mark for a line within the right of withdrawal", async () => {
    open(request)

    expect(await screen.findByText("M yerine XL")).toBeInTheDocument()
    expect(screen.queryByText("Cayma dışı")).toBeNull()
  })
})
