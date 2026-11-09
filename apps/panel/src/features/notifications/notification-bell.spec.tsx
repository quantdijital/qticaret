import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { NotificationBell } from "./notification-bell"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, to }: { children: ReactNode; to: string }) => <a href={to}>{children}</a>,
}))

const alert = (id: string, data: Record<string, unknown>) => ({
  id,
  created_at: "2026-11-01T09:30:00Z",
  data,
})

function renderBell() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <NotificationBell />
    </QueryClientProvider>
  )
}

describe("NotificationBell: contact messages (adr/0047)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("words a contact message from its subject and leads to the messages", async () => {
    fetchMock.mockResolvedValue({
      notifications: [
        alert("noti_1", {
          kind: "contact_message",
          message_id: "cm_1",
          subject: "return",
          title: "Yeni iletişim mesajı: İade ve değişim",
          description: "Ayşe vitrinden yazdı.",
        }),
        // A subject the panel does not know reads as "other"
        alert("noti_2", { kind: "contact_message", message_id: "cm_2", subject: "<b>x</b>" }),
      ],
    })
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 2 yeni" }))

    const first = await screen.findByText("Yeni iletişim mesajı: İade ve değişim")
    expect(first.closest("a")).toHaveAttribute("href", "/customers/contact-messages")
    expect(screen.getByText("Yeni iletişim mesajı: Diğer")).toBeInTheDocument()
    expect(screen.getAllByText(/Vitrindeki iletişim formundan geldi/)).toHaveLength(2)
  })

  it("names a KVKK request's last day to answer", async () => {
    fetchMock.mockResolvedValue({
      notifications: [
        alert("noti_3", {
          kind: "contact_message",
          message_id: "cm_3",
          subject: "kvkk",
          due_at: "2026-12-01T20:59:59.000Z",
        }),
      ],
    })
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))

    expect(await screen.findByText("Yeni iletişim mesajı: KVKK başvurusu")).toBeInTheDocument()
    expect(screen.getByText(/Son gün: 1 Ara 2026/)).toBeInTheDocument()
  })
})

describe("NotificationBell: a return's refund deadline (adr/0032 Ek 2026-11-03)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("words the law's last day from its data and leads to the order's returns", async () => {
    fetchMock.mockResolvedValue({
      notifications: [
        alert("noti_4", {
          kind: "return_refund_deadline",
          return_request_id: "rreq_1",
          order_id: "order_1",
          display_id: "1042",
          due_at: "2026-11-15T09:00:00.000Z",
          // The server's own Turkish wording is not shown: the panel words it
          title: "#1042 siparişinin iadesi için son gün 15 Kasım 2026",
        }),
      ],
    })
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))

    const title = await screen.findByText(
      "Sipariş #1042 iadesinde yasal geri ödeme süresi 15 Kas 2026 tarihinde doluyor"
    )
    expect(title.closest("a")).toHaveAttribute("href", "/orders/$id")
    expect(screen.getByText(/14 gün içinde iade edilmeli/)).toBeInTheDocument()
    expect(screen.queryByText(/son gün 15 Kasım 2026/)).toBeNull()
  })
})

describe("NotificationBell: a paid order placed short of stock (adr/0026 Ek 2026-11-06)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    localStorage.clear()
  })

  it("names the order and the lines the shelf lacked, and leads to the order", async () => {
    fetchMock.mockResolvedValue({
      notifications: [
        alert("noti_5", {
          kind: "stock_short",
          order_id: "order_1",
          number: "696",
          lines: [{ title: "Chuby / Kahverengi", short: 1 }, { title: 3 }],
        }),
      ],
    })
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))

    const title = await screen.findByText("Stok yetersiz sipariş #696")
    expect(title.closest("a")).toHaveAttribute("href", "/orders/$id")
    expect(screen.getByText(/Eksik: Chuby \/ Kahverengi ×1\./)).toBeInTheDocument()
  })
})
