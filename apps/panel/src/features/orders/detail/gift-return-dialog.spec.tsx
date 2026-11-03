import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ReturnRequest } from "@/features/orders/api/returns"
import { ReturnActions } from "@/features/orders/components/return-actions"
import { ApproveGiftReturnDialog } from "./gift-return-dialog"

const fetchMock = vi.hoisted(() => vi.fn())
const retrieveMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { order: { retrieve: retrieveMock } } },
}))
vi.mock("sonner", () => ({ toast }))

const request: ReturnRequest = {
  id: "rreq_1",
  order_id: "order_1",
  order_display_id: 1042,
  kind: "return",
  exchange_items: null,
  difference: null,
  status: "requested",
  reason: "changed_mind",
  note: null,
  items: [
    {
      line_item_id: "ordli_2",
      quantity: 2,
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
  created_at: "2026-11-03T09:00:00Z",
}

const LINES = [
  { id: "ordli_1", title: "Şef bıçağı", metadata: null },
  {
    id: "ordli_2",
    title: "Hediye kartı 500 TL",
    metadata: { qt_gift: { recipient_email: "ayse@example.com" } },
  },
]

const wrap = (node: ReactNode) =>
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      {node}
    </QueryClientProvider>
  )

describe("ApproveGiftReturnDialog (adr/0025 Ek 2026-11-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    retrieveMock.mockResolvedValue({ order: { items: LINES } })
  })

  it("says the cards are voided and the money goes at once, then approves", async () => {
    fetchMock.mockResolvedValue({ return_request: request, refund_error: null })
    const onClose = vi.fn()
    wrap(<ApproveGiftReturnDialog request={request} onClose={onClose} />)

    expect(await screen.findByText("Hediye kartı 500 TL")).toBeInTheDocument()
    expect(screen.getByText("2 kart")).toBeInTheDocument()
    expect(
      screen.getByText(
        "Hediye kartı iadesi: kartlar iptal edilir, para iadesi hemen yapılır; kargo beklenmez."
      )
    ).toBeInTheDocument()
    await userEvent.click(
      screen.getByRole("button", { name: "Kartları iptal et ve parayı iade et" })
    )

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/approve", {
        method: "POST",
        body: {},
      })
    })
    expect(toast.success).toHaveBeenCalledWith("Kartlar iptal edildi, para iade edildi.")
    expect(onClose).toHaveBeenCalled()
  })

  it("says a refund that failed in words, with how to try again", async () => {
    fetchMock.mockResolvedValue({
      return_request: { ...request, status: "received" },
      refund_error: "Ödeme sağlayıcısı iadeyi kabul etmedi.",
    })
    wrap(<ApproveGiftReturnDialog request={request} onClose={vi.fn()} />)

    await userEvent.click(
      await screen.findByRole("button", { name: "Kartları iptal et ve parayı iade et" })
    )

    await waitFor(() => {
      expect(toast.warning).toHaveBeenCalledWith(
        'Kartlar iptal edildi ama para iadesi yapılamadı: Ödeme sağlayıcısı iadeyi kabul etmedi. İşlemler menüsündeki "Para iadesini tekrar dene" ile yeniden deneyin.'
      )
    })
    expect(toast.success).not.toHaveBeenCalled()
  })
})

describe("ReturnActions: approving a gift card withdrawal asks first", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    fetchMock.mockResolvedValue({ return_request: request })
    retrieveMock.mockResolvedValue({ order: { items: LINES } })
  })

  const approve = async (shown: ReturnRequest) => {
    const onOpen = vi.fn()
    wrap(<ReturnActions request={shown} onOpen={onOpen} />)
    await userEvent.click(screen.getByRole("button", { name: "İade talebi işlemleri" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Onayla" }))
    return onOpen
  }

  it("opens the gift card dialog for a request of gift card lines, approving nothing yet", async () => {
    const onOpen = await approve(request)

    await waitFor(() => {
      expect(onOpen).toHaveBeenCalledWith({ kind: "gift", request })
    })
    expect(retrieveMock).toHaveBeenCalledWith("order_1", {
      fields: "items.id,items.title,items.variant_title,items.metadata",
    })
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it("approves any other return at once, as before", async () => {
    const knife: ReturnRequest = {
      ...request,
      items: [
        {
          line_item_id: "ordli_1",
          quantity: 1,
          withdrawal_excluded: false,
          withdrawal_excluded_reason: null,
          withdrawal_warning: null,
        },
      ],
    }
    const onOpen = await approve(knife)

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/return-requests/rreq_1/approve", {
        method: "POST",
        body: {},
      })
    })
    expect(onOpen).not.toHaveBeenCalled()
  })
})
