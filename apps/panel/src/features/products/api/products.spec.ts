import { QueryClient } from "@tanstack/react-query"
import { beforeEach, describe, expect, it, vi } from "vitest"
import { matchingProductIds } from "./bulk"
import { productsQuery } from "./products"

const fetchMock = vi.hoisted(() => vi.fn())
const listMock = vi.hoisted(() => vi.fn())

vi.mock("@/lib/sdk", () => ({
  sdk: { client: { fetch: fetchMock }, admin: { product: { list: listMock } } },
}))

const read = (params: Parameters<typeof productsQuery>[0]) =>
  new QueryClient().query(productsQuery(params))

describe("the product list's page (owner 2026-11-06)", () => {
  beforeEach(() => {
    fetchMock.mockReset()
    listMock.mockReset()
  })

  it("asks the board with the filters, then loads those products in its order", async () => {
    fetchMock.mockResolvedValue({ ids: ["prod_b", "prod_a"], count: 42, limited: false })
    listMock.mockResolvedValue({ products: [{ id: "prod_a" }, { id: "prod_b" }] })

    const page = await read({
      q: "çakı",
      status: "draft",
      category: "pcat_1",
      brand: "brand_1",
      stock: "low",
      missing: "image",
      kind: "physical",
      sort: "price_desc",
      page: 2,
    })

    expect(fetchMock).toHaveBeenCalledWith("/admin/product-board", {
      query: {
        q: "çakı",
        status: "draft",
        category_id: "pcat_1",
        brand_id: "brand_1",
        stock: "low",
        missing: "image",
        kind: "physical",
        order: "-price",
        offset: 40,
        limit: 20,
      },
    })
    expect(listMock).toHaveBeenCalledWith(
      expect.objectContaining({ id: ["prod_b", "prod_a"], limit: 2 })
    )
    expect(page.products.map((product) => product.id)).toEqual(["prod_b", "prod_a"])
    expect(page).toMatchObject({ count: 42, limited: false })
  })

  it("orders by the last change with no filter, and loads nothing for an empty page", async () => {
    fetchMock.mockResolvedValue({ ids: [], count: 0, limited: false })

    const page = await read({ q: "", status: "all", page: 0 })

    expect(fetchMock).toHaveBeenCalledWith("/admin/product-board", {
      query: { order: "-updated_at", offset: 0, limit: 20 },
    })
    expect(listMock).not.toHaveBeenCalled()
    expect(page.products).toEqual([])
  })

  it("reads as many products as the person's page size asks", async () => {
    fetchMock.mockResolvedValue({ ids: [], count: 0, limited: false })

    await read({ q: "", status: "all", page: 2, pageSize: 50 })

    expect(fetchMock).toHaveBeenCalledWith("/admin/product-board", {
      query: { order: "-updated_at", offset: 100, limit: 50 },
    })
  })

  it("selects every match for a bulk change, none past the limit", async () => {
    fetchMock.mockResolvedValueOnce({ ids: ["prod_a"], count: 1, limited: false })
    expect(await matchingProductIds({ q: "", status: "all", stock: "out" })).toEqual({
      ids: ["prod_a"],
      count: 1,
    })
    expect(fetchMock).toHaveBeenCalledWith("/admin/product-board", {
      query: { stock: "out", order: "-updated_at", offset: 0, limit: 1000 },
    })

    fetchMock.mockResolvedValueOnce({ ids: ["prod_a"], count: 1500, limited: false })
    expect(await matchingProductIds({ q: "", status: "all" })).toEqual({ ids: [], count: 1500 })
  })
})
