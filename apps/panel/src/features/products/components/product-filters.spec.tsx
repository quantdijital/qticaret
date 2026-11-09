import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { ProductFilterBar } from "./product-filters"
import type { FilterValues } from "./product-filters"

const fetchMock = vi.hoisted(() => vi.fn())
const categoryList = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: { productCategory: { list: categoryList } },
  },
}))

function renderBar(values: FilterValues, onChange = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ProductFilterBar values={values} onChange={onChange} />
    </QueryClientProvider>
  )
  return onChange
}

describe("the product list's filters", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    categoryList.mockResolvedValue({
      product_categories: [
        { id: "pcat_knives", name: "Bıçaklar", parent_category_id: null, rank: 0 },
        { id: "pcat_chef", name: "Şef Bıçakları", parent_category_id: "pcat_knives", rank: 0 },
      ],
    })
    fetchMock.mockResolvedValue({ brand: { id: "brand_1", name: "Örnek" } })
  })

  it("says what each chosen filter is, and lets them all go at once", async () => {
    const onChange = renderBar({
      category: "pcat_chef",
      brand: "brand_1",
      stock: "low",
      missing: "image",
      sort: "price",
    })
    expect(await screen.findByText("Kategori: Şef Bıçakları")).toBeInTheDocument()
    expect(await screen.findByText("Örnek")).toBeInTheDocument()
    expect(screen.getByText("Stok: Az kaldı")).toBeInTheDocument()
    expect(screen.getByText("Eksik: Görseli yok")).toBeInTheDocument()
    expect(screen.getByText("Sırala: Fiyat (artan)")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("button", { name: "Filtreleri temizle" }))
    expect(onChange).toHaveBeenCalledWith({
      category: undefined,
      brand: undefined,
      stock: undefined,
      missing: undefined,
      kind: undefined,
    })
  })

  it("picks a quick filter and an order, and shows no clearing without a filter", async () => {
    const onChange = renderBar({})
    expect(screen.queryByRole("button", { name: "Filtreleri temizle" })).toBeNull()
    expect(screen.getByText("Sırala: Son değişiklik")).toBeInTheDocument()

    await userEvent.click(screen.getByRole("combobox", { name: "Eksik" }))
    await userEvent.click(await screen.findByRole("option", { name: "Açıklaması yok" }))
    expect(onChange).toHaveBeenLastCalledWith({ missing: "description" })

    await userEvent.click(screen.getByRole("combobox", { name: "Kategori" }))
    const child = await screen.findByRole("option", { name: "Şef Bıçakları" })
    // Indented under its parent
    expect(child).toHaveStyle({ paddingLeft: "24px" })
    await userEvent.click(child)
    expect(onChange).toHaveBeenLastCalledWith({ category: "pcat_chef" })

    await userEvent.click(screen.getByRole("combobox", { name: "Sırala" }))
    await userEvent.click(await screen.findByRole("option", { name: "Stok (az olan önce)" }))
    expect(onChange).toHaveBeenLastCalledWith({ sort: "stock" })
  })
})
