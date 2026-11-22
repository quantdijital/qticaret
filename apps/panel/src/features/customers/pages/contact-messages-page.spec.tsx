import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { MouseEventHandler, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { STAFF_KEY } from "@/features/auth/api/staff"
import type { StaffRole } from "@/features/auth/api/staff"
import type { ContactMessage } from "@/features/customers/api/contact-messages"
import { ContactMessagesPage } from "./contact-messages-page"

const fetchMock = vi.hoisted(() => vi.fn())
// The address's search; a test may set a subject
const search = vi.hoisted(() => ({ value: {} }))
const navigateMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
// The page reads its tab from the address; here it is always the waiting ones
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, onClick }: { children: ReactNode; onClick?: MouseEventHandler }) => (
    <a href="/orders" onClick={onClick}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.value }),
  useNavigate: () => navigateMock,
}))

const message = (id: string, more: Partial<ContactMessage> = {}): ContactMessage => ({
  id,
  subject: "order",
  order_number: "1042",
  customer_id: null,
  status: "new",
  handled_by: null,
  handled_at: null,
  created_at: "2026-11-01T09:30:00Z",
  name: "Ayşe Yılmaz",
  email: "ayse@example.com",
  phone: "+905321234567",
  body: "Siparişim nerede?\n<b>Kargo</b> numarası gelmedi.",
  ...more,
})

// What each role's `can` holds for the two capabilities the screen reads (backend CAPABILITY_PROBES)
const CAN: Record<StaffRole, { orders: boolean; settings: boolean }> = {
  owner: { orders: true, settings: true },
  admin: { orders: true, settings: true },
  operations: { orders: true, settings: false },
  readonly: { orders: false, settings: false },
}

function serve(messages: ContactMessage[]) {
  fetchMock.mockImplementation((url: string, init?: { method?: string }) =>
    Promise.resolve(
      url === "/admin/contact-messages"
        ? { contact_messages: messages, count: messages.length, offset: 0, limit: 50 }
        : init?.method === "DELETE"
          ? { id: "cm_1", deleted: true }
          : { id: "cm_1", status: "handled" }
    )
  )
}

function renderPage(role: StaffRole) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  // Known up front, so what a role may not do is absent rather than not yet loaded
  client.setQueryData(STAFF_KEY, { user_id: "user_1", role, can: CAN[role] })
  return render(
    <QueryClientProvider client={client}>
      <ContactMessagesPage />
    </QueryClientProvider>
  )
}

async function openFirst() {
  await userEvent.click(await screen.findByRole("button", { name: "Ayşe Yılmaz" }))
  return screen.findByRole("dialog")
}

describe("ContactMessagesPage", () => {
  beforeEach(() => {
    search.value = {}
    fetchMock.mockReset()
    navigateMock.mockReset()
    serve([message("cm_1"), message("cm_2", { name: "Ali Veli", subject: "return" })])
  })

  it("lists the waiting messages with their sender, subject and order", async () => {
    renderPage("owner")

    expect(await screen.findByRole("button", { name: "Ayşe Yılmaz" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Ali Veli" })).toBeInTheDocument()
    expect(screen.getByText("İade ve değişim")).toBeInTheDocument()
    expect(screen.getAllByText("#1042")).toHaveLength(2)
    expect(screen.getByRole("tab", { name: "Bekleyen", selected: true })).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/contact-messages", {
      query: { status: "new", offset: 0, limit: 50 },
    })
  })

  it("says so when nothing waits", async () => {
    serve([])
    renderPage("owner")

    expect(await screen.findByText(/Bekleyen mesaj yok/)).toBeInTheDocument()
  })

  it("opens a message with ways to reply, its text as typed, and marks it answered", async () => {
    renderPage("operations")
    const sheet = await openFirst()

    const email = within(sheet).getByRole("link", { name: "ayse@example.com" })
    expect(email.getAttribute("href")).toBe(
      `mailto:ayse@example.com?subject=${encodeURIComponent("Mesajınız hakkında: Sipariş (sipariş #1042)")}`
    )
    expect(within(sheet).getByRole("link", { name: "+90 532 123 45 67" })).toHaveAttribute(
      "href",
      "tel:+905321234567"
    )
    // Text, never markup: the tag shows as typed, the line break stays
    const body = within(sheet).getByText(/Siparişim nerede\?/)
    expect(body.textContent).toBe("Siparişim nerede?\n<b>Kargo</b> numarası gelmedi.")
    expect(body.querySelector("b")).toBeNull()

    await userEvent.click(within(sheet).getByRole("button", { name: "Yanıtlandı olarak işaretle" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/contact-messages/cm_1", {
        method: "POST",
        body: { status: "handled" },
      })
    })
  })

  it("puts an answered message back to waiting", async () => {
    serve([message("cm_1", { status: "handled", handled_at: "2026-11-01T10:00:00Z" })])
    renderPage("admin")
    const sheet = await openFirst()

    await userEvent.click(within(sheet).getByRole("button", { name: "Bekleyene geri al" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/contact-messages/cm_1", {
        method: "POST",
        body: { status: "new" },
      })
    })
  })

  it("deletes a message only once the dialog is confirmed", async () => {
    renderPage("owner")
    const sheet = await openFirst()

    await userEvent.click(within(sheet).getByRole("button", { name: "Sil" }))
    const confirm = await screen.findByRole("alertdialog")
    expect(confirm).toHaveTextContent("Ayşe Yılmaz adlı kişinin mesajı kalıcı olarak silinir.")
    expect(fetchMock).not.toHaveBeenCalledWith("/admin/contact-messages/cm_1", expect.anything())

    await userEvent.click(within(confirm).getByRole("button", { name: "Mesajı kalıcı olarak sil" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/contact-messages/cm_1", { method: "DELETE" })
    })
  })

  it("offers each role only what the API lets it do", async () => {
    const { unmount } = renderPage("operations")
    let sheet = await openFirst()
    expect(within(sheet).getByRole("button", { name: "Yanıtlandı olarak işaretle" })).toBeVisible()
    expect(within(sheet).queryByRole("button", { name: "Sil" })).not.toBeInTheDocument()
    unmount()

    renderPage("readonly")
    sheet = await openFirst()
    expect(within(sheet).getByText(/Siparişim nerede\?/)).toBeInTheDocument()
    expect(
      within(sheet).queryByRole("button", { name: "Yanıtlandı olarak işaretle" })
    ).not.toBeInTheDocument()
    expect(within(sheet).queryByRole("button", { name: "Sil" })).not.toBeInTheDocument()
  })

  it("shows a booking request's product, dates and people, with a phone only (adr/0076 Ek 2026-11-23)", async () => {
    serve([
      message("cm_3", {
        subject: "booking",
        order_number: null,
        email: "",
        body: "",
        product_id: "prod_1",
        product_title: "Kapadokya turu",
        details: { month: "2027-03", adults: 2, children: 1 },
      }),
    ])
    renderPage("owner")

    expect(await screen.findByText("Rezervasyon talebi")).toBeInTheDocument()
    expect(screen.getByText("Kapadokya turu")).toBeInTheDocument()
    const sheet = await openFirst()
    expect(within(sheet).getByRole("link", { name: "Kapadokya turu" })).toBeInTheDocument()
    expect(within(sheet).getByText("Mart 2027")).toBeInTheDocument()
    expect(within(sheet).getByText("2 yetişkin, 1 çocuk")).toBeInTheDocument()
    // No address to mail, no message to show
    expect(within(sheet).queryByRole("link", { name: /@/ })).not.toBeInTheDocument()
    expect(within(sheet).queryByText("Mesaj")).not.toBeInTheDocument()
  })

  it("says open dates when a request names none, and asks for one subject when filtered", async () => {
    search.value = { subject: "booking" }
    serve([
      message("cm_4", {
        subject: "booking",
        product_id: "prod_1",
        product_title: "Kapadokya turu",
        details: { adults: 1 },
      }),
    ])
    renderPage("owner")

    const sheet = await openFirst()
    expect(within(sheet).getByText("Tarih esnek")).toBeInTheDocument()
    expect(within(sheet).getByText("1 yetişkin")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/contact-messages", {
      query: { status: "new", offset: 0, limit: 50, subject: "booking" },
    })
  })

  it("finds requests by a phone number, typed or in the address (adr/0076 Ek 2026-11-23)", async () => {
    search.value = { phone: "0532 123 45 67" }
    renderPage("owner")

    await screen.findByRole("button", { name: "Ayşe Yılmaz" })
    expect(fetchMock).toHaveBeenCalledWith("/admin/contact-messages", {
      query: { status: "new", offset: 0, limit: 50, phone: "0532 123 45 67" },
    })
    const box = screen.getByRole("searchbox", { name: "Telefonla ara" })
    await userEvent.clear(box)
    await userEvent.type(box, "05551112233")
    await waitFor(() => {
      expect(navigateMock).toHaveBeenLastCalledWith(
        expect.objectContaining({
          search: { status: undefined, subject: undefined, phone: "05551112233", page: undefined },
        })
      )
    })
  })
})
