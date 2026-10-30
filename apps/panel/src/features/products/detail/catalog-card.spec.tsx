import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { ProductCatalog } from "@/features/products/api/product-edit"
import { CatalogCard } from "./catalog-card"

const fetchMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: fetchMock } } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const CATALOG: ProductCatalog = {
  condition: "new",
  kind: "physical",
  primary_category_id: null,
  withdrawal_excluded: false,
  restriction: null,
  successor: null,
  categories: [],
  variants: [],
}

describe("CatalogCard", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    fetchMock.mockImplementation((url: string, init?: { body?: Partial<ProductCatalog> }) =>
      Promise.resolve(url.includes("/catalog") ? { ...CATALOG, ...init?.body } : { features: [] })
    )
  })

  it("marks a product outside the right of withdrawal, sending only that", async () => {
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CatalogCard productId="prod_1" />
      </QueryClientProvider>
    )
    const toggle = await screen.findByRole("switch", { name: "Cayma hakkı dışında" })
    expect(toggle).not.toBeChecked()

    await userEvent.click(toggle)
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { withdrawal_excluded: true },
      })
    })
  })

  it("offers the age limit once the shop sells to adults only, sending the reason", async () => {
    fetchMock.mockImplementation((url: string, init?: { body?: Partial<ProductCatalog> }) =>
      Promise.resolve(
        url.includes("/catalog")
          ? { ...CATALOG, ...init?.body }
          : { features: [{ key: "catalog.restricted", enabled: true }] }
      )
    )
    render(
      <QueryClientProvider client={new QueryClient()}>
        <CatalogCard productId="prod_1" />
      </QueryClientProvider>
    )

    await userEvent.click(await screen.findByRole("combobox", { name: "Yaş sınırı" }))
    await userEvent.click(await screen.findByRole("option", { name: "Silah ve kesici alet" }))
    await userEvent.click(screen.getByRole("button", { name: "Kaydet" }))

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_1/catalog", {
        method: "POST",
        body: { restriction: "weapon" },
      })
    })
  })
})
