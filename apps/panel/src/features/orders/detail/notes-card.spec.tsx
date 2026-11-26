import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OrderNote } from "@/features/orders/api/notes"
import { NotesCard } from "./notes-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn(), warning: vi.fn() }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast }))

const NOTES: OrderNote[] = [
  {
    id: "onote_1",
    body: "Müşteri aradı.\nKapıya bırakılsın.",
    created_at: "2026-10-30T08:00:00Z",
    author: { id: "user_2", name: "Elif Kaya" },
    deletable: false,
  },
  {
    id: "onote_2",
    body: "Paket iki kat sarıldı.",
    created_at: "2026-10-30T09:00:00Z",
    author: null,
    deletable: true,
  },
]

function serve(can: { orders: boolean }, notes: OrderNote[] = NOTES) {
  fetchMock.mockImplementation((path: string, init?: { method?: string }) => {
    if (path === "/admin/staff/me") {
      return Promise.resolve({ user_id: "user_1", role: "operations", can })
    }
    if (init?.method === "POST") {
      return Promise.resolve({ note: { id: "onote_3" } })
    }
    if (init?.method === "DELETE") {
      return Promise.resolve({ id: "onote_2", deleted: true })
    }
    return Promise.resolve({ notes })
  })
}

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={client}>
      <NotesCard orderId="order_1" />
    </QueryClientProvider>
  )
}

describe("NotesCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    vi.clearAllMocks()
  })

  it("shows each note with its author, and offers removal only where it is allowed", async () => {
    serve({ orders: true })
    renderCard()

    expect(await screen.findByText("Elif Kaya")).toBeInTheDocument()
    expect(screen.getByText("Ekipten ayrılan kişi")).toBeInTheDocument()
    expect(screen.getAllByRole("button", { name: "Notu sil" })).toHaveLength(1)
  })

  it("adds a note trimmed, and empties the box", async () => {
    const user = userEvent.setup()
    serve({ orders: true })
    renderCard()
    const box = await screen.findByRole("textbox", { name: "Yeni not" })

    expect(screen.getByRole("button", { name: "Notu ekle" })).toBeDisabled()
    await user.type(box, "  Kargo yarın çıkacak.  ")
    await user.click(screen.getByRole("button", { name: "Notu ekle" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/notes", {
      method: "POST",
      body: { body: "Kargo yarın çıkacak." },
    })
    expect(box).toHaveValue("")
  })

  it("sends a note to the customer when asked, and says when it did not go", async () => {
    const user = userEvent.setup()
    serve({ orders: true })
    fetchMock.mockImplementation((path: string, init?: { method?: string }) => {
      if (path === "/admin/staff/me") {
        return Promise.resolve({ user_id: "user_1", role: "operations", can: { orders: true } })
      }
      if (init?.method === "POST") {
        return Promise.resolve({ note: { id: "onote_3" }, sent: "sent" })
      }
      return Promise.resolve({ notes: NOTES })
    })
    renderCard()
    const box = await screen.findByRole("textbox", { name: "Yeni not" })

    await user.type(box, "Kılıf yarın geliyor.")
    await user.click(screen.getByRole("checkbox", { name: /Müşteriye gönder/ }))
    await user.click(screen.getByRole("button", { name: "Ekle ve gönder" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/notes", {
      method: "POST",
      body: { body: "Kılıf yarın geliyor.", notify_customer: true },
    })
    expect(toast.success).toHaveBeenCalledWith("Not eklendi ve müşteriye gönderildi.")
    // Unticked again for the next note
    expect(screen.getByRole("checkbox", { name: /Müşteriye gönder/ })).not.toBeChecked()

    fetchMock.mockImplementation((path: string, init?: { method?: string }) =>
      init?.method === "POST"
        ? Promise.resolve({ note: { id: "onote_4" }, sent: "template_off" })
        : Promise.resolve({ notes: NOTES, user_id: "user_1", can: { orders: true } })
    )
    await user.type(box, "İkinci not.")
    await user.click(screen.getByRole("checkbox", { name: /Müşteriye gönder/ }))
    await user.click(screen.getByRole("button", { name: "Ekle ve gönder" }))
    expect(toast.warning).toHaveBeenCalledWith(
      "Not eklendi ama müşteriye gönderilmedi: bu ileti Ayarlar > Müşteri iletileri'nde kapalı."
    )
  })

  it("marks the notes that went to the customer", async () => {
    serve({ orders: true }, [
      { ...NOTES[0], sent_to_customer: "sent" } as OrderNote,
      { ...NOTES[1], sent_to_customer: "skipped" } as OrderNote,
    ])
    renderCard()

    expect(await screen.findByText("Müşteriye gönderildi")).toBeInTheDocument()
    expect(screen.getByText("Gönderilemedi")).toBeInTheDocument()
  })

  it("asks before it removes a note", async () => {
    const user = userEvent.setup()
    serve({ orders: true })
    renderCard()

    await user.click(await screen.findByRole("button", { name: "Notu sil" }))
    const dialog = screen.getByRole("alertdialog")
    await user.click(within(dialog).getByRole("button", { name: "Notu sil" }))

    expect(fetchMock).toHaveBeenCalledWith("/admin/orders/order_1/notes/onote_2", {
      method: "DELETE",
    })
    expect(toast.success).toHaveBeenCalledWith("Not silindi.")
  })

  it("shows the notes without a box to staff who only read", async () => {
    serve({ orders: false }, [])
    renderCard()

    expect(await screen.findByText("Henüz not yok.")).toBeInTheDocument()
    expect(screen.queryByRole("textbox", { name: "Yeni not" })).toBeNull()
  })
})
