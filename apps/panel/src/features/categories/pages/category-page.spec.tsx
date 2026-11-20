import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { CategoryPage } from "./category-page"

const fetchMock = vi.hoisted(() => vi.fn())
const admin = vi.hoisted(() => ({
  productCategory: { list: vi.fn(), update: vi.fn(), delete: vi.fn() },
}))
const navigate = vi.hoisted(() => vi.fn())
const params = vi.hoisted(() => ({ id: "sef" }))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: ReactNode }) => <a href="/categories">{children}</a>,
  getRouteApi: () => ({ useParams: () => params }),
  useNavigate: () => navigate,
}))
// Each card has its own spec; here the page shows them in their places
vi.mock("@/features/seo/advisor/advisor-card", () => ({
  AdvisorCard: ({ id }: { id: string }) => <p>advisor {id}</p>,
}))
vi.mock("@/features/seo/components/seo-card", () => ({
  SeoCard: ({ context }: { context: { path: string } }) => <p>seo {context.path}</p>,
}))
vi.mock("@/features/categories/components/category-image-card", () => ({
  CategoryImageCard: ({ categoryId }: { categoryId: string }) => <p>image {categoryId}</p>,
}))
vi.mock("@/features/categories/components/category-description-card", () => ({
  CategoryDescriptionCard: ({ categoryId }: { categoryId: string }) => (
    <p>description {categoryId}</p>
  ),
}))
vi.mock("@/features/categories/components/category-restriction-card", () => ({
  CategoryRestrictionCard: ({ categoryId }: { categoryId: string }) => (
    <p>restriction {categoryId}</p>
  ),
}))

const category = (id: string, name: string, parent: string | null, extra = {}) => ({
  id,
  name,
  handle: id,
  description: "Japon ve Alman çelikleri.",
  parent_category_id: parent,
  rank: 0,
  is_active: true,
  is_internal: false,
  updated_at: "2026-11-01T10:00:00Z",
  ...extra,
})

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CategoryPage />
    </QueryClientProvider>
  )
}

describe("CategoryPage", () => {
  beforeEach(() => {
    params.id = "sef"
    navigate.mockReset()
    admin.productCategory.update.mockReset().mockResolvedValue({})
    admin.productCategory.delete.mockReset().mockResolvedValue({})
    admin.productCategory.list.mockReset().mockResolvedValue({
      product_categories: [
        category("mutfak", "Mutfak", null),
        category("sef", "Şef bıçakları", "mutfak", { is_internal: true }),
      ],
    })
    fetchMock.mockReset().mockResolvedValue({ values: { url_style: { category: "nested" } } })
  })

  it("shows the category's name, parents and visibility over its cards", async () => {
    renderPage()

    expect(await screen.findByRole("heading", { name: "Şef bıçakları" })).toBeInTheDocument()
    expect(screen.getByText("Mutfak", { selector: "p" })).toBeInTheDocument()
    expect(screen.getByText("Yayında")).toBeInTheDocument()
    expect(screen.getAllByText("İç kategori").length).toBeGreaterThan(0)
    expect(screen.getByRole("textbox", { name: /Kategori adı/ })).toHaveValue("Şef bıçakları")
    expect(screen.getByText("image sef")).toBeInTheDocument()
    expect(screen.getByText("seo /kategori/mutfak/sef")).toBeInTheDocument()
    expect(screen.getByText("advisor sef")).toBeInTheDocument()
    expect(screen.getByText("restriction sef")).toBeInTheDocument()
    expect(screen.getByText("description sef")).toBeInTheDocument()
  })

  // The owner (2026-11-20): a long text on the left leaves the side cards in sight
  it("keeps the advisor, picture and age limit in the side column that follows the scroll", async () => {
    renderPage()
    const advisor = await screen.findByText("advisor sef")
    const side = advisor.closest("[data-layout-free]")

    expect(side).not.toBeNull()
    expect(side).toContainElement(screen.getByText("image sef"))
    expect(side).toContainElement(screen.getByText("restriction sef"))
    expect(side).not.toContainElement(screen.getByText("description sef"))
    expect(side).not.toContainElement(screen.getByText("seo /kategori/mutfak/sef"))
  })

  it("saves the general card's changes to the category", async () => {
    renderPage()
    const name = await screen.findByRole("textbox", { name: /Kategori adı/ })

    await userEvent.clear(name)
    await userEvent.type(name, "Şef ve santoku")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(admin.productCategory.update).toHaveBeenCalledWith(
        "sef",
        expect.objectContaining({ name: "Şef ve santoku", parent_category_id: "mutfak" })
      )
    })
    // The text is written through its own route only (adr/0075 §9): Medusa's would stale its document
    expect(admin.productCategory.update.mock.calls[0]?.[1]).not.toHaveProperty("description")
  })

  it("deletes the category once confirmed and goes back to the list", async () => {
    renderPage()

    await userEvent.click(await screen.findByRole("button", { name: "Kategoriyi sil" }))
    const dialog = await screen.findByRole("alertdialog")
    await userEvent.click(within(dialog).getByRole("button", { name: "Kategoriyi sil" }))

    await waitFor(() => {
      expect(admin.productCategory.delete).toHaveBeenCalledWith("sef")
    })
    expect(navigate).toHaveBeenCalledWith({ to: "/categories" })
  })

  it("says so when the category is gone", async () => {
    params.id = "yok"
    renderPage()

    expect(
      await screen.findByText("Bu kategori bulunamadı; silinmiş olabilir.")
    ).toBeInTheDocument()
  })
})
