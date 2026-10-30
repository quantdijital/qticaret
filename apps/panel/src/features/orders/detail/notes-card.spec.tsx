import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { OrderNote } from "@/features/orders/api/notes"
import { NotesCard } from "./notes-card"

const fetchMock = vi.hoisted(() => vi.fn())
const toast = vi.hoisted(() => ({ success: vi.fn(), error: vi.fn() }))

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
