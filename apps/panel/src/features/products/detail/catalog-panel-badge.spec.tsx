import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import type { ReactNode } from "react"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { CatalogPanel } from "./catalog-panel"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ to, children }: { to: string; children: ReactNode }) => <a href={to}>{children}</a>,
}))

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "physical",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  is_gift_card: false,
  addons: [],
  description_doc: null,
  summary_doc: null,
  successor: null,
  categories: [],
  variants: [],
}

function answer(manual: boolean, catalog: Partial<ProductCatalog> = {}) {
  fetchMock.mockImplementation((url: string, init?: { body?: Partial<ProductCatalog> }) => {
    if (url.includes("/catalog")) {
      return Promise.resolve({ ...CATALOG, ...catalog, ...init?.body })
    }
    if (url === "/admin/platform-settings/product_badges") {
      return Promise.resolve({
        section: "product_badges",
        version: 1,
        values: {
          manual_enabled: manual,
          new_enabled: false,
          new_days: 30,
          best_seller_enabled: false,
          best_seller_min_units: 10,
        },
      })
    }
    return Promise.resolve({ features: [] })
  })
}

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <CatalogPanel productId="prod_1" />
    </QueryClientProvider>
  )
}

function openDialog() {
  return screen.findByRole("form", { name: "Katalog bilgileri" })
}

describe("CatalogPanel: the product's own badge", () => {
  beforeEach(() => {
    fetchMock.mockReset()
  })

  it("offers the field while the shop has its own badges on, and sends it cut", async () => {
    answer(true)
    renderCard()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/product_badges")
    })
    await openDialog()
    const field = await screen.findByLabelText("Ürün rozeti")
    // Letters are counted as the server counts them, not by the input's UTF-16 units
    expect(field).not.toHaveAttribute("maxLength")
    await userEvent.type(field, "  Sınırlı ")
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { badge: "Sınırlı" },
      })
    })
  })

  it("hides the field while they are off, unless the product already has one", async () => {
    answer(false)
    renderCard()
    await openDialog()
    expect(screen.queryByLabelText("Ürün rozeti")).toBeNull()
  })

  it("counts letters as a reader sees them: 24 emoji pass, 25 letters do not", async () => {
    answer(true)
    renderCard()
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/platform-settings/product_badges")
    })
    await openDialog()
    const field = await screen.findByLabelText("Ürün rozeti")
    // Each two UTF-16 units: a maxLength would have cut them at 12
    await userEvent.type(field, "🔥".repeat(24))
    expect(field).toHaveValue("🔥".repeat(24))
    await userEvent.clear(field)
    await userEvent.type(field, "x".repeat(25))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    expect(await screen.findByText("En çok 24 karakter.")).toBeInTheDocument()
    expect(fetchMock).not.toHaveBeenCalledWith(
      "/admin/products/prod_1/catalog",
      expect.objectContaining({ method: "POST" })
    )
  })

  it("shows a saved badge in its field and clears it with an empty field", async () => {
    answer(false, { badge: "Erken rezervasyon" })
    renderCard()
    expect(await screen.findByLabelText("Ürün rozeti")).toHaveValue("Erken rezervasyon")
    await openDialog()
    await userEvent.clear(await screen.findByLabelText("Ürün rozeti"))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { badge: null },
      })
    })
  })
})
