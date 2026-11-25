import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { FilterBar } from "@qticaret/admin-ui/patterns/filter-bar"
import "@/lib/i18n"
import { useProductFilters } from "./product-filters"
import { ProductSort } from "./product-sort"
import type { FilterValues } from "./product-filters"

const fetchMock = vi.hoisted(() => vi.fn())
const categoryList = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: {
    client: { fetch: fetchMock },
    admin: { productCategory: { list: categoryList } },
  },
}))

function Bar({ values, onChange }: { values: FilterValues; onChange: (next: object) => void }) {
  const bar = useProductFilters(values, onChange)
  return (
    <FilterBar
      {...bar}
      actions={
        <ProductSort
          value={values.sort}
          onChange={(sort) => {
            onChange({ sort })
          }}
        />
      }
    />
  )
}

function renderBar(values: FilterValues, onChange = vi.fn()) {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <Bar values={values} onChange={onChange} />
    </QueryClientProvider>
  )
  return onChange
}

const filterButton = () => screen.getByRole("button", { name: /^Filtrele( · \d+)?$/ })

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

  it("shows each chosen filter as a chip, and lets them all go at once", async () => {
    const onChange = renderBar({
      category: "pcat_chef",
      brand: "brand_1",
      stock: "low",
      missing: "image",
      sort: "price",
    })
    expect(filterButton()).toHaveTextContent("Filtrele · 4")
    expect(
      await screen.findByRole("button", { name: "Kategori: Şef Bıçakları" })
    ).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "Marka: Örnek" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Stok: Az kaldı" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Eksik: Görseli yok" })).toBeInTheDocument()
    // The order is not a filter: no chip, its own control
    expect(screen.getByRole("combobox", { name: "Sırala" })).toHaveTextContent(
      "Sırala: Fiyat (artan)"
    )

    await userEvent.click(screen.getByRole("button", { name: "Tümünü temizle" }))
    expect(onChange).toHaveBeenCalledWith({
      category: undefined,
      brand: undefined,
      stock: undefined,
      missing: undefined,
      kind: undefined,
    })
  })

  it("picks a quick filter, a category in its tree and an order", async () => {
    const onChange = renderBar({})
    expect(screen.queryByRole("button", { name: "Tümünü temizle" })).toBeNull()
    expect(screen.getByRole("combobox", { name: "Sırala" })).toHaveTextContent(
      "Sırala: Son değişiklik"
    )

    await userEvent.click(filterButton())
    await userEvent.click(await screen.findByRole("button", { name: /^Eksik/ }))
    await userEvent.click(screen.getByRole("button", { name: "Açıklaması yok" }))
    expect(onChange).toHaveBeenLastCalledWith({ missing: "description" })

    await userEvent.click(filterButton())
    await userEvent.click(await screen.findByRole("button", { name: /^Kategori/ }))
    const child = await screen.findByRole("button", { name: "Şef Bıçakları" })
    // Indented under its parent
    expect(child).toHaveStyle({ paddingLeft: "24px" })
    await userEvent.click(child)
    expect(onChange).toHaveBeenLastCalledWith({ category: "pcat_chef" })

    await userEvent.click(screen.getByRole("combobox", { name: "Sırala" }))
    await userEvent.click(await screen.findByRole("option", { name: "Stok (az olan önce)" }))
    expect(onChange).toHaveBeenLastCalledWith({ sort: "stock" })
  })

  it("searches a brand inside the menu, the picker named (axe: button-name)", async () => {
    renderBar({})
    await userEvent.click(filterButton())
    await userEvent.click(await screen.findByRole("button", { name: /^Marka/ }))
    const menu = screen.getByRole("dialog")
    expect(within(menu).getByRole("combobox", { name: "Marka" })).toHaveTextContent("Tüm markalar")
  })
})
