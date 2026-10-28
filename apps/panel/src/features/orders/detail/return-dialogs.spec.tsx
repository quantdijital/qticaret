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
  status: "approved",
  reason: "damaged",
  note: null,
  items: [{ line_item_id: "ordli_1", quantity: 2 }],
  decision_note: null,
  return_code: "123456789012",
  return_label_file_id: null,
  received_items: null,
  refund_amount: null,
  created_at: "2026-10-28T09:00:00Z",
}

describe("ReceiveReturnDialog (adr/0032)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ refund_error: null })
    retrieveMock.mockResolvedValue({ order: { items: [{ id: "ordli_1", title: "Şef bıçağı" }] } })
  })

  it("receives fewer than asked when some did not come back", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(
      <QueryClientProvider client={client}>
        <ReceiveReturnDialog request={request} onClose={vi.fn()} />
      </QueryClientProvider>
    )

    const quantity = await screen.findByLabelText("Şef bıçağı için gelen adet")
    fireEvent.change(quantity, { target: { value: "1" } })
    await userEvent.click(screen.getByRole("button", { name: "Teslim al" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/receive", {
        method: "POST",
        body: { items: [{ line_item_id: "ordli_1", quantity: 1 }] },
      })
    })
  })
})
