import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import type { LinkedProduct, ProductCatalog } from "@/features/products/api/product-edit"
import { LinkedProductsCard } from "./linked-products-card"

const fetchMock = vi.hoisted(() => vi.fn())
const listMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { product: { list: listMock } } },
}))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))

const row = (id: string, title: string, status = "published"): LinkedProduct => ({
  id,
  title,
  handle: id,
  status,
  thumbnail: null,
})

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
  upsells: [row("prod_a", "Şef Bıçağı"), row("prod_b", "Ekmek Bıçağı", "draft")],
  cross_sells: [],
}

function renderCard() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <LinkedProductsCard productId="prod_self" />
    </QueryClientProvider>
  )
}

describe("LinkedProductsCard (S3)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    listMock.mockReset()
    fetchMock.mockImplementation((_url: string, init?: { body?: Record<string, string[]> }) => {
      if (!init?.body) {
        return Promise.resolve(CATALOG)
      }
      // The server answers the lists it saved, in their order
      const all = [...(CATALOG.upsells ?? []), row("prod_c", "Bileği Taşı")]
      const pick = (ids: string[] = []) => ids.flatMap((id) => all.filter((p) => p.id === id))
      return Promise.resolve({
        ...CATALOG,
        upsells: pick(init.body["upsell_product_ids"]),
        cross_sells: pick(init.body["cross_sell_product_ids"]),
      })
    })
    listMock.mockResolvedValue({
      products: [
        row("prod_self", "Bu ürün"),
        row("prod_a", "Şef Bıçağı"),
        row("prod_c", "Bileği Taşı"),
      ],
    })
  })

  it("lists the saved order, marks a draft, and saves a moved, added and removed product", async () => {
    const user = userEvent.setup()
    renderCard()
    const upsells = await screen.findByRole("list", { name: "Benzer / daha iyi ürünler" })
    expect(
      within(upsells)
        .getAllByRole("listitem")
        .map((li) => li.textContent)
    ).toEqual([expect.stringContaining("Şef Bıçağı"), expect.stringContaining("Taslak")])
    await user.click(screen.getByRole("button", { name: "Ekmek Bıçağı: yukarı taşı" }))

    // The search offers neither the product itself nor one listed already
    const picker = screen.getByRole("combobox", { name: "Birlikte alınanlar" })
    await user.click(picker)
    const option = await screen.findByRole("option", { name: "Bileği Taşı" })
    expect(screen.queryByRole("option", { name: "Bu ürün" })).toBeNull()
    await user.click(option)
    await user.click(screen.getByRole("button", { name: "Şef Bıçağı: kaldır" }))

    await user.click(screen.getByRole("button", { name: "Kaydet" }))
    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/admin/products/prod_self/catalog", {
        method: "POST",
        body: { upsell_product_ids: ["prod_b"], cross_sell_product_ids: ["prod_c"] },
      })
    })
  })
})
