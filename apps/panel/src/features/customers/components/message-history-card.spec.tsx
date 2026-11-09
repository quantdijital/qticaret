import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { MessageHistory } from "@/features/customers/api/messages"
import { MessageHistoryCard } from "./message-history-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))

const staff = vi.hoisted(() => ({ resend: true }))
vi.mock("@/features/auth/api/staff", () => ({
  useCan: (capability: string) => capability === "resendMessages" && staff.resend,
}))

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

  it("sends an order's message again after asking, for a role that may", async () => {
    const user = userEvent.setup()
    const placed = { ...HISTORY.messages[1], resendable: true }
    fetchMock.mockImplementation((_path: string, init?: { method?: string }) =>
      Promise.resolve(
        init?.method === "POST"
          ? { channel: "email", outcome: "sent" }
          : { messages: [placed], limited: false }
      )
    )
    staff.resend = true
    renderCard({ orderId: "order_1" })

    await user.click(await screen.findByRole("button", { name: "Yeniden gönder" }))
    expect(screen.getByText("Mesaj yeniden gönderilsin mi?")).toBeInTheDocument()
    // The confirmation's own button
    await user.click(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Yeniden gönder" })
    )
    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/messages/noti_1/resend", {
      method: "POST",
      body: {},
    })
  })

  it("offers no resend on a customer's history, nor to a role that may not", async () => {
    fetchMock.mockResolvedValue({
      messages: [{ ...HISTORY.messages[1], resendable: true }],
      limited: false,
    })
    renderCard({ customerId: "cus_1" })
    expect(await screen.findByText("Gönderildi")).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "Yeniden gönder" })).not.toBeInTheDocument()
  })

  it("shows the newest three and opens the rest on request", async () => {
    const at = (hour: number) => `2026-10-30T${String(hour).padStart(2, "0")}:00:00Z`
    fetchMock.mockResolvedValue({
      messages: ["order.delivered", "order.shipped", "order.placed", "return.requested"].map(
        (template, index) => ({
          id: `noti_${String(index)}`,
          template,
          channel: "email",
          state: "sent",
          reason: null,
          to: "ay***@example.com",
          at: at(12 - index),
        })
      ),
      limited: false,
    })
    renderCard({ orderId: "order_1" })

    expect(await screen.findByText("Sipariş kargoda")).toBeInTheDocument()
    expect(screen.getAllByRole("listitem")).toHaveLength(3)
    await userEvent.click(screen.getByRole("button", { name: "Tümünü göster (4)" }))
    expect(screen.getAllByRole("listitem")).toHaveLength(4)
    expect(screen.getByRole("button", { name: "Daha az göster" })).toHaveAttribute(
      "aria-expanded",
      "true"
    )
  })
})
