import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { MouseEventHandler, ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { CategoriesPage } from "./categories-page"

const fetchMock = vi.hoisted(() => vi.fn())
const list = vi.hoisted(() => vi.fn())
const update = vi.hoisted(() => vi.fn())
const navigate = vi.hoisted(() => vi.fn())
const search = vi.hoisted((): { value: { q?: string; selected?: string } } => ({ value: {} }))

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: { productCategory: { list, update, create: vi.fn() } },
  },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({
    children,
    params,
    search: query,
    onClick,
    "aria-label": label,
  }: {
    children: ReactNode
    params?: { id: string }
    search?: { category: string }
    onClick?: MouseEventHandler
    "aria-label"?: string
  }) => (
    <a
      href={params ? `/categories/${params.id}` : `/products?category=${query?.category ?? ""}`}
      aria-label={label}
      onClick={(event) => {
        // A test's DOM does not navigate
        event.preventDefault()
        onClick?.(event)
      }}
    >
      {children}
    </a>
  ),
  getRouteApi: () => ({ useSearch: () => search.value }),
  useNavigate: () => navigate,
}))

const category = (id: string, name: string, parent: string | null, rank: number, extra = {}) => ({
  id,
  name,
  handle: id,
  description: "",
  parent_category_id: parent,
  rank,
  is_active: true,
  is_internal: false,
  updated_at: "2026-11-01T10:00:00Z",
  ...extra,
})

const TREE = [
  category("kamp", "Kamp", null, 1, { is_active: false }),
  category("mutfak", "Mutfak", null, 0),
  category("sef", "Şef bıçakları", "mutfak", 0),
  category("santoku", "Santoku", "sef", 0),
  category("ekmek", "Ekmek bıçakları", "mutfak", 1),
]

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CategoriesPage />
    </QueryClientProvider>
  )
}

/** The names in the table, top to bottom. */
const names = () =>
  screen
    .getAllByRole("row")
    .slice(1)
    .map((row) => within(row).getAllByRole("link")[0]?.textContent)

describe("CategoriesPage", () => {
  beforeEach(() => {
    navigate.mockReset()
    update.mockReset().mockResolvedValue({})
    search.value = {}
    list.mockReset().mockResolvedValue({ product_categories: TREE })
    fetchMock.mockReset().mockImplementation((path: string) =>
      Promise.resolve(
        path === "/admin/category-counts"
          ? { counts: { mutfak: 12, sef: 7, santoku: 3, ekmek: 5, kamp: 0 } }
          : path === "/admin/category-images"
            ? {
                images: [{ category_id: "mutfak", url: "https://cdn.example/m.webp", alt: null }],
              }
            : path === "/admin/platform-settings/seo"
              ? { values: { url_style: { category: "prefixed" } } }
              : {}
      )
    )
  })

  it("lists parents first with their children under them, each with its address and visibility", async () => {
    renderPage()

    expect(await screen.findByText("Şef bıçakları")).toBeInTheDocument()
    expect(names()).toEqual(["Mutfak", "Şef bıçakları", "Santoku", "Ekmek bıçakları", "Kamp"])
    expect(screen.getByText("/kategori/mutfak/sef/santoku")).toBeInTheDocument()
    expect(screen.getByText("Gizli")).toBeInTheDocument()
    expect(screen.getAllByText("Yayında")).toHaveLength(4)

    await userEvent.click(screen.getByRole("button", { name: "Mutfak alt kategorilerini gizle" }))
    expect(names()).toEqual(["Mutfak", "Kamp"])
    await userEvent.click(screen.getByRole("button", { name: "Mutfak alt kategorilerini göster" }))
    expect(names()).toHaveLength(5)
    expect(navigate).not.toHaveBeenCalled()
  })

  it("counts each category's products, opening the product list filtered by it", async () => {
    renderPage()

    const count = await screen.findByRole("link", { name: "Mutfak: 12 ürün" })
    expect(count).toHaveAttribute("href", "/products?category=mutfak")
    expect(screen.getByRole("link", { name: "Kamp: 0 ürün" })).toHaveTextContent("0")
    await userEvent.click(count)
    expect(navigate).not.toHaveBeenCalled()
  })

  it("moves a category within its level by taking its sibling's rank", async () => {
    renderPage()

    await screen.findByText("Ekmek bıçakları")
    expect(screen.getByRole("button", { name: "Mutfak yukarı taşı" })).toBeDisabled()
    await userEvent.click(screen.getByRole("button", { name: "Ekmek bıçakları yukarı taşı" }))

    await waitFor(() => {
      expect(update).toHaveBeenCalledWith("ekmek", { rank: 0 })
    })
    expect(navigate).not.toHaveBeenCalled()
  })

  it("opens a category's page from its row", async () => {
    renderPage()

    await userEvent.click(await screen.findByText("/kategori/kamp"))
    expect(navigate).toHaveBeenCalledWith({ to: "/categories/$id", params: { id: "kamp" } })
  })

  it("lists the matches of a search flat, each with its parents' names", async () => {
    search.value = { q: "bıçak" }
    renderPage()

    expect(await screen.findByText("Şef bıçakları")).toBeInTheDocument()
    expect(names()).toEqual(["Şef bıçakları", "Ekmek bıçakları"])
    expect(screen.getAllByText("Mutfak")).toHaveLength(2)
    expect(screen.queryByRole("button", { name: /alt kategorilerini/ })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: /taşı$/ })).not.toBeInTheDocument()
  })

  it("says when a search matches nothing", async () => {
    search.value = { q: "tava" }
    renderPage()

    expect(await screen.findByText("Aramanızla eşleşen kategori yok.")).toBeInTheDocument()
  })

  it("offers the first category from the empty list, asking its name and parent", async () => {
    list.mockResolvedValue({ product_categories: [] })
    renderPage()

    expect(await screen.findByText("Henüz kategori yok. İlk kategorinizi ekleyin.")).toBeVisible()
    const [, fromEmpty] = screen.getAllByRole("button", { name: "Kategori ekle" })
    if (!fromEmpty) {
      throw new Error("no add button in the empty state")
    }
    await userEvent.click(fromEmpty)
    const dialog = await screen.findByRole("dialog")
    expect(within(dialog).getByRole("textbox", { name: /Kategori adı/ })).toBeInTheDocument()
    expect(within(dialog).getByRole("combobox", { name: "Üst kategori" })).toBeInTheDocument()
  })

  it("opens the new category's dialog from the command menu's link", async () => {
    search.value = { selected: "new" }
    renderPage()

    expect(await screen.findByRole("dialog")).toBeInTheDocument()
  })
})
