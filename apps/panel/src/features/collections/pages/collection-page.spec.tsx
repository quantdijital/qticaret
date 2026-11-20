import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { collectionFixture } from "@/features/collections/collection-fixtures"
import { CollectionPage } from "./collection-page"

const fetchMock = vi.hoisted(() => vi.fn())
const admin = vi.hoisted(() => ({
  productCollection: { update: vi.fn(), delete: vi.fn() },
}))
const navigate = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/collections">{children}</a>,
  getRouteApi: () => ({ useParams: () => ({ id: "pcol_1" }) }),
  useNavigate: () => navigate,
}))
// Each has its own spec; here the page's own parts
vi.mock("@/features/seo/advisor/advisor-card", () => ({ AdvisorCard: () => <p>advisor</p> }))
vi.mock("@/features/seo/components/seo-card", () => ({
  SeoCard: ({ context }: { context: { path: string; fallbackDescription: string } }) => (
    <p>
      {context.path} · {context.fallbackDescription}
    </p>
  ),
}))
vi.mock("@/features/collections/components/collection-products-card", () => ({
  CollectionProductsCard: () => null,
}))
vi.mock("@/features/collections/components/collection-image-card", () => ({
  CollectionImageCard: () => <p>picture</p>,
}))
// The text's card has its own spec (listing-description-card.spec.tsx)
vi.mock("@/features/collections/components/collection-description-card", () => ({
  CollectionDescriptionCard: () => <p>description</p>,
}))

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CollectionPage />
    </QueryClientProvider>
  )
}

describe("CollectionPage", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    navigate.mockReset()
    admin.productCollection.update.mockReset().mockResolvedValue({})
    admin.productCollection.delete.mockReset().mockResolvedValue({})
    fetchMock.mockImplementation((url: string, init?: { method?: string; body?: unknown }) =>
      Promise.resolve(
        init?.method === "POST"
          ? { collection: collectionFixture(init.body as object) }
          : { collection: collectionFixture() }
      )
    )
  })

  it("shows the collection's address and text, with its text as the search snippet's fallback", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "Yaz Seçkisi" })).toBeInTheDocument()
    expect(screen.getByText("2 ürün")).toBeInTheDocument()
    expect(screen.getByText(/\/koleksiyon\/yaz-seckisi · Yazın en sevilenleri\./)).toBeVisible()
    expect(screen.getByRole("textbox", { name: /Sayfa adresi/ })).toHaveValue("yaz-seckisi")
  })

  // The owner (2026-11-20): a long text on the left leaves the side cards in sight
  it("keeps the advisor and picture in the side column that follows the scroll", async () => {
    renderPage()
    const side = (await screen.findByText("advisor")).closest("[data-layout-free]")

    expect(side).not.toBeNull()
    expect(side).toContainElement(screen.getByText("picture"))
    expect(side).not.toContainElement(screen.getByText("description"))
  })

  it("saves the name and address through Medusa and the visibility as its details", async () => {
    renderPage()
    const handle = await screen.findByRole("textbox", { name: /Sayfa adresi/ })

    await userEvent.clear(handle)
    await userEvent.type(handle, "yaz-2026")
    await userEvent.click(screen.getByRole("switch"))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(admin.productCollection.update).toHaveBeenCalledWith("pcol_1", {
        handle: "yaz-2026",
      })
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/collections/pcol_1/details", {
      method: "POST",
      body: { is_active: false },
    })
  })

  it("refuses an address that is no slug before saving", async () => {
    renderPage()
    const handle = await screen.findByRole("textbox", { name: /Sayfa adresi/ })

    await userEvent.clear(handle)
    await userEvent.type(handle, "Yaz Seçkisi")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    expect(await screen.findByText(/küçük harf/i)).toBeInTheDocument()
    expect(admin.productCollection.update).not.toHaveBeenCalled()
  })

  it("deletes the collection once confirmed and goes back to the list", async () => {
    renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "İşlemler" }))
    await userEvent.click(await screen.findByRole("menuitem", { name: "Koleksiyonu sil" }))
    const dialog = await screen.findByRole("alertdialog")
    expect(within(dialog).getByText(/Ürünler kalır/)).toBeInTheDocument()
    await userEvent.click(within(dialog).getByRole("button", { name: "Koleksiyonu sil" }))

    await waitFor(() => {
      expect(admin.productCollection.delete).toHaveBeenCalledWith("pcol_1")
    })
    expect(navigate).toHaveBeenCalledWith({ to: "/collections" })
  })
})
