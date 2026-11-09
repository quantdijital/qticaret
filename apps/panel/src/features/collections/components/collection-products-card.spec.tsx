import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"
import "@/lib/i18n"
import { collectionFixture } from "@/features/collections/collection-fixtures"
import { CollectionProductsCard } from "./collection-products-card"

const admin = vi.hoisted(() => ({
  product: { list: vi.fn() },
  productCollection: { updateProducts: vi.fn() },
}))

vi.mock("@/lib/sdk", () => ({ sdk: { client: { fetch: vi.fn() }, admin } }))
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }))
vi.mock("@tanstack/react-router", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <a href="/products">{children}</a>,
}))

const product = (id: string, title: string, status = "published") => ({
  id,
  title,
  status,
  thumbnail: null,
})

function renderCard() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={client}>
      <CollectionProductsCard collection={collectionFixture()} />
    </QueryClientProvider>
  )
}

describe("CollectionProductsCard", () => {
  beforeEach(() => {
    admin.productCollection.updateProducts.mockReset().mockResolvedValue({})
    // The collection's own list asks by collection; the picker searches every product
    admin.product.list.mockReset().mockImplementation((query: { collection_id?: string[] }) =>
      Promise.resolve(
        query.collection_id
          ? { products: [product("prod_1", "Şef Bıçağı")], count: 1 }
          : {
              products: [
                product("prod_1", "Şef Bıçağı"),
                product("prod_2", "Ekmek Bıçağı"),
                product("prod_3", "Satır", "draft"),
              ],
              count: 3,
            }
      )
    )
  })

  it("lists the collection's products and takes one out", async () => {
    renderCard()

    const list = await screen.findByRole("list", { name: "Ürünler" })
    expect(within(list).getByText("Şef Bıçağı")).toBeInTheDocument()
    expect(admin.product.list).toHaveBeenCalledWith(
      expect.objectContaining({ collection_id: ["pcol_1"], offset: 0, order: "title" })
    )

    await userEvent.click(screen.getByRole("button", { name: "Şef Bıçağı: koleksiyondan çıkar" }))
    await waitFor(() => {
      expect(admin.productCollection.updateProducts).toHaveBeenCalledWith("pcol_1", {
        remove: ["prod_1"],
      })
    })
  })

  it("adds the products ticked in the picker in one go, and nothing when it is closed", async () => {
    renderCard()
    await screen.findByRole("list", { name: "Ürünler" })

    await userEvent.click(screen.getByRole("button", { name: "Ürün ekle" }))
    let dialog = await screen.findByRole("dialog", { name: "Koleksiyona ürün ekle" })
    await userEvent.click(await within(dialog).findByRole("button", { name: /Ekmek Bıçağı/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "Vazgeç" }))
    expect(admin.productCollection.updateProducts).not.toHaveBeenCalled()

    await userEvent.click(screen.getByRole("button", { name: "Ürün ekle" }))
    dialog = await screen.findByRole("dialog", { name: "Koleksiyona ürün ekle" })
    expect(within(dialog).getByRole("button", { name: /ürünü ekle/ })).toBeDisabled()
    await userEvent.click(await within(dialog).findByRole("button", { name: /Ekmek Bıçağı/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: /Satır/ }))
    await userEvent.click(within(dialog).getByRole("button", { name: "2 ürünü ekle" }))

    await waitFor(() => {
      expect(admin.productCollection.updateProducts).toHaveBeenCalledWith("pcol_1", {
        add: ["prod_2", "prod_3"],
      })
    })
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument()
    })
  })
})
