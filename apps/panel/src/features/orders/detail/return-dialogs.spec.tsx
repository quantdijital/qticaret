import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { ReceiveReturnDialog } from "./return-dialogs"

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
  kind: "return",
  exchange_items: null,
  difference: null,
  status: "approved",
  reason: "damaged",
  note: null,
  items: [{ line_item_id: "ordli_1", quantity: 2, withdrawal_excluded: false }],
  decision_note: null,
  return_code: "123456789012",
  return_label_file_id: null,
  received_items: null,
  damaged_items: null,
  refund_shipping: false,
  refund_amount: null,
  created_at: "2026-10-28T09:00:00Z",
}

describe("ReceiveReturnDialog (adr/0032)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ refund_error: null })
    retrieveMock.mockResolvedValue({ order: { items: [{ id: "ordli_1", title: "Şef bıçağı" }] } })
  })

  const open = (shown: ReturnRequest) => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ReceiveReturnDialog request={shown} onClose={vi.fn()} />
      </QueryClientProvider>
    )
  }

  it("receives one sound and one damaged, the shipping offered back for a damaged item", async () => {
    open(request)

    const sound = await screen.findByLabelText("Şef bıçağı için sağlam gelen adet")
    fireEvent.change(sound, { target: { value: "1" } })
    fireEvent.change(screen.getByLabelText("Şef bıçağı için hasarlı gelen adet"), {
      target: { value: "1" },
    })
    await userEvent.click(screen.getByRole("button", { name: "Teslim al" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/receive", {
        method: "POST",
        body: {
          items: [{ line_item_id: "ordli_1", quantity: 1 }],
          damaged: [{ line_item_id: "ordli_1", quantity: 1 }],
          refund_shipping: true,
        },
      })
    })
  })

  it("never counts more than was asked, and leaves the shipping to staff on a change of mind", async () => {
    open({ ...request, reason: "changed_mind" })

    const damaged = await screen.findByLabelText("Şef bıçağı için hasarlı gelen adet")
    fireEvent.change(damaged, { target: { value: "2" } })

    // Two damaged of two asked: none left sound
    expect(screen.getByLabelText("Şef bıçağı için sağlam gelen adet")).toHaveValue(0)
    expect(screen.getByRole("checkbox", { name: /Kargo ücretini de iade et/ })).not.toBeChecked()
    await userEvent.click(screen.getByRole("button", { name: "Teslim al" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/receive", {
        method: "POST",
        body: {
          items: [],
          damaged: [{ line_item_id: "ordli_1", quantity: 2 }],
          refund_shipping: false,
        },
      })
    })
  })

  it("marks a line outside the right of withdrawal as the request carries it, asking nothing more", async () => {
    retrieveMock.mockResolvedValue({
      order: {
        items: [
          { id: "ordli_1", title: "Şef bıçağı" },
          { id: "ordli_2", title: "Kişiye özel kılıf" },
        ],
      },
    })
    open({
      ...request,
      items: [
        { line_item_id: "ordli_1", quantity: 2, withdrawal_excluded: false },
        { line_item_id: "ordli_2", quantity: 1, withdrawal_excluded: true },
      ],
    })

    const marked = (await screen.findByText("Kişiye özel kılıf")).closest("li")
    expect(marked).toHaveTextContent("Cayma dışı")
    expect(screen.getByText("Şef bıçağı").closest("li")).not.toHaveTextContent("Cayma dışı")
    expect(screen.getAllByText("Cayma dışı")).toHaveLength(1)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
