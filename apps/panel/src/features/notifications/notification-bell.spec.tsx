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
})
