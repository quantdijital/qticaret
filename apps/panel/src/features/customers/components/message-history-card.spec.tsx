import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MessageHistory } from "@/features/customers/api/messages"
import { MessageHistoryCard } from "./message-history-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const HISTORY: MessageHistory = {
  messages: [
    {
      id: "mskip_1",
      template: "order.shipped",
      channel: "sms",
      state: "skipped",
      reason: "over_quota",
      to: "+905*** *** ** 67",
      at: "2026-10-30T10:00:00Z",
    },
    {
      id: "noti_1",
      template: "order.placed",
      channel: "email",
      state: "sent",
      reason: null,
      to: "ay***@example.com",
      at: "2026-10-30T08:00:00Z",
    },
  ],
  limited: true,
}

function renderCard(props: { orderId: string } | { customerId: string }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <MessageHistoryCard {...props} />
    </QueryClientProvider>
  )
}

describe("MessageHistoryCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockResolvedValue(HISTORY)
  })

  it("names each message, whether it went, and why one did not", async () => {
    renderCard({ orderId: "order_1" })

    expect(await screen.findByText("Sipariş kargoda")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/messages")
    expect(screen.getByText("Gönderilmedi")).toBeInTheDocument()
    expect(screen.getByText("Günlük gönderim sınırı doldu.")).toBeInTheDocument()
    expect(screen.getByText("Gönderildi")).toBeInTheDocument()
    expect(screen.getByText(/ay\*\*\*@example\.com/)).toBeInTheDocument()
    expect(screen.getByText("Son 50 ileti gösteriliyor.")).toBeInTheDocument()
  })

  it("reads a customer's whole history, and says when there is none", async () => {
    fetchMock.mockResolvedValue({ messages: [], limited: false })
    renderCard({ customerId: "cus_1" })

    expect(await screen.findByText("Henüz ileti yok.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/customers/cus_1/messages")
  })

  it("names the gift card e-mail sent to a card's recipient", async () => {
    fetchMock.mockResolvedValue({
      messages: [
        {
          id: "noti_2",
          template: "gift_card.issued",
          channel: "email",
          state: "sent",
          reason: null,
          to: "fa***@example.com",
          at: "2026-11-03T08:00:00Z",
        },
      ],
      limited: false,
    })
    renderCard({ orderId: "order_1" })

    expect(await screen.findByText("Hediye kartı gönderildi")).toBeInTheDocument()
  })
})
