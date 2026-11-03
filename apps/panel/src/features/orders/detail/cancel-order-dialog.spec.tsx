import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { CancelOrderDialog } from "./cancel-order-dialog"

const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))
const fetchMock = vi.fn<typeof fetch>()

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() } } }))
vi.mock("sonner", () => ({ toast }))

const KNIFE = { id: "ordli_1", metadata: null }
const WAITING = { id: "ordli_2", metadata: { qt_gift: { recipient_email: "ayse@example.com" } } }
const ISSUED = {
  id: "ordli_3",
  metadata: {
    qt_gift: { recipient_email: "ayse@example.com" },
    qt_gift_cards: [{ id: "gcard_1", last4: "1234" }],
  },
}

type Items = Parameters<typeof CancelOrderDialog>[0]["order"]["items"]

function renderDialog(items: unknown[]) {
  const onOpenChange = vi.fn()
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CancelOrderDialog
        order={{ id: "order_1", display_id: 1042, items: items as Items }}
        open
        onOpenChange={onOpenChange}
      />
    </QueryClientProvider>
  )
  return onOpenChange
}

const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } })

describe("CancelOrderDialog (adr/0025 Ek 2026-11-03)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("says untouched gift cards are voided and a used one stops the cancel", async () => {
    fetchMock.mockResolvedValue(answer(200, { order: { id: "order_1" } }))
    const onOpenChange = renderDialog([KNIFE, ISSUED])

    expect(
      screen.getByText(/Kartların hiçbiri kullanılmadıysa iptal kartları kapatır/)
    ).toBeInTheDocument()
    expect(screen.getByText(/sipariş iptal edilemez/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole("button", { name: "Siparişi iptal et" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/cancel", {
        method: "POST",
        credentials: "same-origin",
        headers: { "content-type": "application/json", accept: "application/json" },
        body: "{}",
      })
    })
    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Sipariş iptal edildi.")
    })
    expect(onOpenChange).toHaveBeenCalledWith(false)
  })

  it("says cards not issued yet will not be", () => {
    renderDialog([WAITING])
    expect(screen.getByText(/kartlar henüz üretilmedi/)).toBeInTheDocument()
  })

  it("says nothing of gift cards for an order without one", () => {
    renderDialog([KNIFE])
    expect(screen.getByText(/ayrılan stok geri döner/)).toBeInTheDocument()
    expect(screen.queryByText(/hediye kartı/i)).toBeNull()
  })

  it("says a spent card's refusal in staff's words, by the server's key", async () => {
    fetchMock.mockResolvedValue(
      answer(409, {
        type: "conflict",
        code: "orders.gift_card_used",
        message:
          "Hediye kartı kullanıldığı için sipariş iptal edilemez; iade için mağazayla iletişime geçin.",
      })
    )
    renderDialog([ISSUED])

    await userEvent.click(screen.getByRole("button", { name: "Siparişi iptal et" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "Sipariş iptal edilemedi: hediye kartlarından biri harcandı ya da kapatıldı; kartlar alıcıya ait. Diğer ürünler için para iadesi ya da iade talebi kullanın."
      )
    })
  })

  it("shows any other refusal as the server says it", async () => {
    fetchMock.mockResolvedValue(
      answer(400, {
        type: "not_allowed",
        code: "orders.cancel_after_packing",
        message: "Paketlenmiş sipariş iptal edilemez.",
      })
    )
    renderDialog([KNIFE])

    await userEvent.click(screen.getByRole("button", { name: "Siparişi iptal et" }))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Paketlenmiş sipariş iptal edilemez.")
    })
  })
})
