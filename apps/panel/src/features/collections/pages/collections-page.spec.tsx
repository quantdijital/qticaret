import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { MouseEventHandler, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { collectionFixture } from "@/features/collections/collection-fixtures"
import { CollectionsPage } from "./collections-page"

const fetchMock = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted(() => ({ value: {} }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children, onClick }: { children: ReactNode; onClick?: MouseEventHandler }) => (
    <a href="/collections/pcol_1" onClick={onClick}>
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.value }),
  useNavigate: () => navigate,
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CollectionsPage />
    </QueryClientProvider>
  )
}

describe("CollectionsPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    search.value = {}
  })

  it("lists each collection with its address, picture, product count and visibility", async () => {
    fetchMock.mockResolvedValue({
      collections: [
        collectionFixture({ image: { url: "https://cdn.example/yaz.webp", alt: null } }),
        collectionFixture({
          id: "pcol_2",
          title: "Arşiv",
          handle: "arsiv",
          is_active: false,
          product_count: 0,
        }),
      ],
      count: 2,
    })
    renderPage()

    expect(await screen.findByText("Yaz Seçkisi")).toBeInTheDocument()
    expect(screen.getByText("/koleksiyon/yaz-seckisi")).toBeInTheDocument()
    expect(screen.getByText("Yayında")).toBeInTheDocument()
    expect(screen.getByText("Gizli")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/collection-board", {
      query: { offset: 0, limit: 25 },
    })

    await userEvent.click(screen.getByText("/koleksiyon/arsiv"))
    expect(navigate).toHaveBeenCalledWith({ to: "/collections/$id", params: { id: "pcol_2" } })
  })

  it("searches collections by the address's `q` and says when nothing matches", async () => {
    search.value = { q: "kis" }
    fetchMock.mockResolvedValue({ collections: [], count: 0 })
    renderPage()

    expect(await screen.findByText("Aramanızla eşleşen koleksiyon yok.")).toBeInTheDocument()
    expect(fetchMock).toHaveBeenCalledWith("/admin/collection-board", {
      query: { offset: 0, limit: 25, q: "kis" },
    })
  })

  it("offers a new collection by its name from the empty list", async () => {
    fetchMock.mockResolvedValue({ collections: [], count: 0 })
    renderPage()

    const [first] = await screen.findAllByRole("button", { name: "Koleksiyon ekle" })
    if (!first) {
      throw new Error("no add button")
    }
    await userEvent.click(first)
    expect(await screen.findByRole("dialog")).toBeInTheDocument()
    await waitFor(() => {
      expect(screen.getByRole("textbox", { name: /Koleksiyon adı/ })).toHaveFocus()
    })
  })
})
