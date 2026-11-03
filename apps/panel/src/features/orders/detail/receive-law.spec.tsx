import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnRequest, ReturnRequestLine } from "@/features/orders/api/returns"
import { ReceiveReturnDialog } from "./return-dialogs"

const fetchMock = vi.hoisted(() => vi.fn())
const retrieveMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { order: { retrieve: retrieveMock } } },
}))
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))

vi.mock("sonner", () => ({ toast }))

const line = (line_item_id: string, more: Partial<ReturnRequestLine> = {}): ReturnRequestLine => ({
  line_item_id,
  quantity: 1,
  withdrawal_excluded: false,
  withdrawal_excluded_reason: null,
  withdrawal_warning: null,
  ...more,
})

const request = (more: Partial<ReturnRequest>): ReturnRequest => ({
  id: "rreq_1",
  order_id: "order_1",
  order_display_id: 1042,
  kind: "return",
  exchange_items: null,
  difference: null,
  status: "approved",
  reason: "changed_mind",
  note: null,
  items: [],
  decision_note: null,
  return_code: "123456789012",
  return_label_file_id: null,
  received_items: null,
  damaged_items: null,
  refused_items: null,
  refund_shipping: false,
  refund_amount: null,
  handed_over_at: null,
  received_at: null,
  refund_due_at: null,
  created_at: "2026-10-28T09:00:00Z",
  ...more,
})

const SEALED = "Mühürlü ürün: açıldıysa iade edilmez"

const open = (shown: ReturnRequest) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <ReceiveReturnDialog request={shown} onClose={vi.fn()} />
    </QueryClientProvider>
  )
}

const receivedWith = async (body: Record<string, unknown>) => {
  await userEvent.click(screen.getByRole("button", { name: "Teslim al" }))
  await waitFor(() => {
    expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/receive", {
      method: "POST",
      body,
    })
  })
}

describe("ReceiveReturnDialog: the 2026 regulation (adr/0032 Ek 2026-11-03)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ refund_error: null })
    toast.success.mockReset()
    retrieveMock.mockResolvedValue({
      order: {
        items: [
          { id: "ordli_1", title: "Diş fırçası" },
          { id: "ordli_2", title: "Şef bıçağı" },
          { id: "ordli_3", title: "Kişiye özel kılıf" },
        ],
      },
    })
  })

  it("offers the refused count only on a sealed good's line, the sound count giving way", async () => {
    open(
      request({
        items: [
          line("ordli_1", { quantity: 2, withdrawal_warning: "sealed_goods" }),
          line("ordli_2"),
        ],
      })
    )

    const refused = await screen.findByLabelText("Diş fırçası için ambalajı açılmış gelen adet")
    expect(screen.queryByLabelText("Şef bıçağı için ambalajı açılmış gelen adet")).toBeNull()
    const sealedRow = screen.getByText("Diş fırçası").closest("li")
    expect(sealedRow).not.toBeNull()
    expect(within(sealedRow as HTMLElement).getByText(SEALED)).toBeInTheDocument()
    expect(screen.getByText("Şef bıçağı").closest("li")).not.toHaveTextContent(SEALED)
    expect(screen.getByText(/koruyucu ambalajı açılmış gelen adetleri/)).toBeInTheDocument()

    fireEvent.change(refused, { target: { value: "1" } })
    expect(screen.getByLabelText("Diş fırçası için sağlam gelen adet")).toHaveValue(1)

    await receivedWith({
      items: [
        { line_item_id: "ordli_1", quantity: 1 },
        { line_item_id: "ordli_2", quantity: 1 },
      ],
      damaged: [],
      refused: [{ line_item_id: "ordli_1", quantity: 1 }],
      refund_shipping: true,
    })
  })

  it("receives a sealed good refused whole with no money back, the shipping not offered", async () => {
    open(request({ items: [line("ordli_1", { withdrawal_warning: "sealed_goods" })] }))

    fireEvent.change(await screen.findByLabelText("Diş fırçası için ambalajı açılmış gelen adet"), {
      target: { value: "1" },
    })
    const shipping = screen.getByRole("checkbox", { name: /Kargo ücretini de iade et/ })
    expect(shipping).not.toBeChecked()
    expect(shipping).toBeDisabled()
    expect(screen.getByText("Kabul edilen ürün yok; para iadesi yapılmaz.")).toBeInTheDocument()

    await receivedWith({
      items: [],
      damaged: [],
      refused: [{ line_item_id: "ordli_1", quantity: 1 }],
      refund_shipping: false,
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Teslim alındı: ambalajı açılmış ürünler reddedildi, para iadesi yapılmadı. Ürünü müşteriye geri gönderin."
      )
    })
  })

  it("leaves the shipping to staff only once every line taken back is outside the right", async () => {
    open(
      request({
        reason: "damaged",
        items: [
          line("ordli_2"),
          line("ordli_3", {
            withdrawal_excluded: true,
            withdrawal_excluded_reason: "personal_addon",
          }),
        ],
      })
    )

    // A line inside the right of withdrawal is taken back: the law's
    const knife = await screen.findByLabelText("Şef bıçağı için sağlam gelen adet")
    const shipping = screen.getByRole("checkbox", { name: /Kargo ücretini de iade et/ })
    expect(shipping).toBeDisabled()
    expect(shipping).toBeChecked()

    // Only the excluded line comes back faulty: the staff's call, offered ticked (TKHK md. 11)
    fireEvent.change(knife, { target: { value: "0" } })
    expect(shipping).toBeEnabled()
    expect(shipping).toBeChecked()
    expect(screen.getByText(/Yalnız cayma hakkı dışındaki ürünler döndü/)).toBeInTheDocument()
    await userEvent.click(shipping)

    await receivedWith({
      items: [{ line_item_id: "ordli_3", quantity: 1 }],
      damaged: [],
      refused: [],
      refund_shipping: false,
    })
  })
})
