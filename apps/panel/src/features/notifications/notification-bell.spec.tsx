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
  Link: ({
    children,
    to,
    onClick,
    className,
  }: {
    children: ReactNode
    to: string
    onClick?: () => void
    className?: string
  }) => (
    <a
      href={to}
      className={className}
      onClick={(event) => {
        event.preventDefault()
        onClick?.()
      }}
    >
      {children}
    </a>
  ),
}))

const alert = (id: string, data: Record<string, unknown>, read = false) => ({
  id,
  created_at: "2026-11-01T09:30:00Z",
  data,
  read,
})

/** `GET /admin/alerts` as the server answers: the page and the person's unread count. */
const feed = (notifications: ReturnType<typeof alert>[]) => ({
  notifications,
  count: notifications.length,
  unread: notifications.filter((each) => !each.read).length,
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
  })

  it("words a contact message from its subject and leads to the messages", async () => {
    fetchMock.mockResolvedValue(
      feed([
        alert("noti_1", {
          kind: "contact_message",
          message_id: "cm_1",
          subject: "return",
          title: "Yeni iletişim mesajı: İade ve değişim",
          description: "Ayşe vitrinden yazdı.",
        }),
        // A subject the panel does not know reads as "other"
        alert("noti_2", { kind: "contact_message", message_id: "cm_2", subject: "<b>x</b>" }),
      ])
    )
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 2 yeni" }))

    const first = await screen.findByText("Yeni iletişim mesajı: İade ve değişim")
    expect(first.closest("a")).toHaveAttribute("href", "/customers/contact-messages")
    expect(screen.getByText("Yeni iletişim mesajı: Diğer")).toBeInTheDocument()
    expect(screen.getAllByText(/Vitrindeki iletişim formundan geldi/)).toHaveLength(2)
  })

  it("names a KVKK request's last day to answer", async () => {
    fetchMock.mockResolvedValue(
      feed([
        alert("noti_3", {
          kind: "contact_message",
          message_id: "cm_3",
          subject: "kvkk",
          due_at: "2026-12-01T20:59:59.000Z",
        }),
      ])
    )
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))

    expect(await screen.findByText("Yeni iletişim mesajı: KVKK başvurusu")).toBeInTheDocument()
    expect(screen.getByText(/Son gün: 1 Ara 2026/)).toBeInTheDocument()
  })
})

describe("NotificationBell: a return's refund deadline (adr/0032 Ek 2026-11-03)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("words the law's last day from its data and leads to the order's returns", async () => {
    fetchMock.mockResolvedValue(
      feed([
        alert("noti_4", {
          kind: "return_refund_deadline",
          return_request_id: "rreq_1",
          order_id: "order_1",
          display_id: "1042",
          due_at: "2026-11-15T09:00:00.000Z",
          // The server's own Turkish wording is not shown: the panel words it
          title: "#1042 siparişinin iadesi için son gün 15 Kasım 2026",
        }),
      ])
    )
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
  })

  it("names the order and the lines the shelf lacked, and leads to the order", async () => {
    fetchMock.mockResolvedValue(
      feed([
        alert("noti_5", {
          kind: "stock_short",
          order_id: "order_1",
          number: "696",
          lines: [{ title: "Chuby / Kahverengi", short: 1 }, { title: 3 }],
        }),
      ])
    )
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))

    const title = await screen.findByText("Stok yetersiz sipariş #696")
    expect(title.closest("a")).toHaveAttribute("href", "/orders/$id")
    expect(screen.getByText(/Eksik: Chuby \/ Kahverengi ×1\./)).toBeInTheDocument()
  })
})

describe("NotificationBell: a paid cart's trouble (security review 2026-11-09)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("names the provider, reference and cart of a payment that cannot become an order", async () => {
    fetchMock.mockResolvedValue(
      feed([
        alert("noti_6", {
          kind: "payment_issue",
          issue: "completion_stuck",
          provider: "paytr",
          reference: "payses01ABC",
          cart_id: "cart_01XYZ",
          amount: 21000,
        }),
        alert("noti_7", {
          kind: "payment_issue",
          issue: "refunded_before_order",
          provider: "paytr",
          reference: "payses01DEF",
          cart_id: null,
          amount: 21000,
        }),
        // An issue the panel does not know is not worded as one
        alert("noti_8", { kind: "payment_issue", issue: "other", title: "Sunucunun metni" }),
      ])
    )
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 3 yeni" }))

    expect(await screen.findByText("PayTR ödemesi siparişe dönüşemiyor")).toBeInTheDocument()
    expect(screen.getByText(/payses01ABC, sepet cart_01XYZ/)).toBeInTheDocument()
    expect(
      screen.getByText("İade edilmiş PayTR ödemesi siparişe dönüştürülmedi")
    ).toBeInTheDocument()
    expect(screen.getByText(/payses01DEF, sepet —/)).toBeInTheDocument()
  })

  it("words a wholesale cart whose prices could not be set, and leads to the wholesalers", async () => {
    fetchMock.mockResolvedValue(
      feed([
        alert("noti_14", {
          kind: "payment_issue",
          issue: "wholesale_price_check",
          provider: "paytr",
          reference: "payses01GHI",
          cart_id: "cart_01W",
        }),
      ])
    )
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))

    const title = await screen.findByText("Toptan sepetin ödemesi başlatılamadı")
    expect(title.closest("a")).toHaveAttribute("href", "/wholesale")
    expect(screen.getByText(/Sepet cart_01W toptancının/)).toBeInTheDocument()
  })
})

describe("NotificationBell: a wholesaler's order and what is read (ADR-0068, adr/0020)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("asks the bell's own route, leads a wholesaler's order to the wholesale list, counts only the unread", async () => {
    fetchMock.mockResolvedValue(
      feed([
        // As the bell's route sends it: no company (the page names it)
        alert("noti_9", {
          kind: "wholesale_order",
          order_id: "order_9",
          number: "1201",
          total: "₺4.500,00",
          bank_transfer: true,
        }),
        alert("noti_10", { kind: "low_stock", name: "Kupa", available: 2, threshold: 5 }, true),
      ])
    )
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/alerts/bell")
    const title = await screen.findByText("Yeni toptan sipariş #1201")
    expect(title.closest("a")).toHaveAttribute("href", "/wholesale/orders")
    expect(screen.getByText("₺4.500,00 · Havale bekleniyor")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "Tümünü gör" })).toHaveAttribute(
      "href",
      "/notifications"
    )
  })

  it("words a retail order and a transfer awaited, each leading to the order", async () => {
    fetchMock.mockResolvedValue(
      feed([
        alert("noti_12", {
          kind: "new_order",
          order_id: "order_12",
          number: "88",
          total: "₺120,00",
        }),
        alert("noti_13", {
          kind: "bank_transfer_pending",
          order_id: "order_13",
          number: "89",
          total: "₺75,00",
        }),
      ])
    )
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 2 yeni" }))

    const order = await screen.findByText("Yeni sipariş #88")
    expect(order.closest("a")).toHaveAttribute("href", "/orders/$id")
    expect(screen.getByText("₺120,00")).toBeInTheDocument()
    expect(screen.getByText("Havale bekleniyor: #89").closest("a")).toHaveAttribute(
      "href",
      "/orders/$id"
    )
    expect(
      screen.getByText("₺75,00 tutarındaki ödeme gelince siparişi onaylayın.")
    ).toBeInTheDocument()
  })

  it("marks an alert read as it is followed, and all of them with one button", async () => {
    fetchMock.mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/alerts/read"
          ? { ok: true }
          : feed([alert("noti_11", { kind: "wholesale_order", number: "7", company: "Kaya" })])
      )
    )
    renderBell()

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))
    await userEvent.click(await screen.findByText("Yeni toptan sipariş #7"))
    expect(fetchMock).toHaveBeenCalledWith("/admin/alerts/read", {
      method: "POST",
      body: { ids: ["noti_11"] },
    })

    await userEvent.click(await screen.findByRole("button", { name: "Bildirimler, 1 yeni" }))
    await userEvent.click(await screen.findByRole("button", { name: "Tümünü okundu say" }))
    expect(fetchMock).toHaveBeenCalledWith("/admin/alerts/read", {
      method: "POST",
      body: { all: true },
    })
  })
})
