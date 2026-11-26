import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreProduct } from "@qticaret/types"

// S3: the shop's linked products in place of the category's, and the cart's cross-sells
const product = (id: string): StoreProduct =>
  ({ id, title: `Ürün ${id}`, handle: id, images: [], variants: [] }) as unknown as StoreProduct

const requests = vi.hoisted(() => ({
  allCategories: vi.fn(),
  listProducts: vi.fn(),
  pathsOf: vi.fn((_kind: string, ids: readonly string[]) =>
    Promise.resolve(Object.fromEntries(ids.map((id) => [id, `/${id}`])))
  ),
  priceDisplays: vi.fn(() => Promise.resolve({})),
  storefrontSettings: vi.fn(() => Promise.resolve({ features: {} })),
  productQuestions: vi.fn(),
  productReviews: vi.fn(),
}))
const extras = vi.hoisted(() => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
  linkedProductIds: vi.fn<(kind: string, ids: readonly string[]) => Promise<string[]>>(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/store-api/requests", () => requests)
vi.mock("@/lib/store-api/extras", () => extras)
vi.mock("@/lib/store-api/server", () => ({ storeGet: vi.fn() }))
vi.mock("../theme-settings", () => ({ cardOptions: vi.fn(() => Promise.resolve({})) }))

const { relatedProducts } = await import("../section-data")
const { relatedOf } = await import("../product-extras")
const { crossSellProducts, withSuggestions } = await import("../cart-cross-sells")

/** The store answers the ids asked, in its own order, those it has. */
function storeHas(ids: readonly string[]) {
  requests.listProducts.mockImplementation((query: { ids?: string[]; categoryIds?: string[] }) =>
    Promise.resolve({
      products: query.ids
        ? [...query.ids]
            .reverse()
            .filter((id) => ids.includes(id))
            .map(product)
        : ["prod_cat1", "prod_cat2"].map(product),
      count: 2,
    })
  )
}

const page = { id: "prod_self", categoryIds: ["pcat_1"] }

describe("a product's linked products (S3)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeHas(["prod_a", "prod_b"])
  })

  it("fill its category's rail in the shop's order, the product itself left out", async () => {
    const rail = await relatedProducts({ kind: "same_category" }, 4, {
      ...page,
      upsellIds: ["prod_b", "prod_self", "prod_a"],
    })
    expect(rail.map((each) => each.id)).toEqual(["prod_b", "prod_a"])
    expect(requests.listProducts).toHaveBeenCalledTimes(1)
  })

  it("leave the category's rail as before when there are none, or none live", async () => {
    const plain = await relatedProducts({ kind: "same_category" }, 4, page)
    expect(plain.map((each) => each.id)).toEqual(["prod_cat1", "prod_cat2"])
    const gone = await relatedProducts({ kind: "same_category" }, 4, {
      ...page,
      upsellIds: ["prod_gone"],
    })
    expect(gone.map((each) => each.id)).toEqual(["prod_cat1", "prod_cat2"])
  })

  it("take the fixed similar products' place, else its category's four", async () => {
    const shop = {
      ...product("prod_self"),
      categories: [{ id: "pcat_1" }],
    } as unknown as StoreProduct
    const linked = await relatedOf(shop, ["prod_a", "prod_b"])
    expect(linked.map((card) => card.id)).toEqual(["prod_a", "prod_b"])
    const plain = await relatedOf(shop)
    expect(plain.map((card) => card.id)).toEqual(["prod_cat1", "prod_cat2"])
  })
})

describe("a cart's cross-sells (S3)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeHas(["prod_a", "prod_b", "prod_c"])
  })

  it("are asked for the cart's products and never offer one already in it", async () => {
    extras.linkedProductIds.mockResolvedValue(["prod_a", "prod_in", "prod_b", "prod_c"])
    const offered = await crossSellProducts(["prod_in", "prod_x"], 2)
    expect(extras.linkedProductIds).toHaveBeenCalledWith("cross_sell", ["prod_in", "prod_x"])
    expect(offered.map((each) => each.id)).toEqual(["prod_a", "prod_b"])
  })

  it("ask nothing for an empty cart and offer nothing without links", async () => {
    expect(await crossSellProducts([], 4)).toEqual([])
    expect(extras.linkedProductIds).not.toHaveBeenCalled()
    extras.linkedProductIds.mockResolvedValue([])
    expect(await crossSellProducts(["prod_in"], 4)).toEqual([])
    expect(requests.listProducts).not.toHaveBeenCalled()
  })

  it("leave the drawer as it was without suggestions", () => {
    const mini = { lines: [], subtotal: "0,00 TL", freeShipping: null }
    expect(withSuggestions(mini, null)).toBe(mini)
    expect(withSuggestions(null, { title: "x", products: [] })).toBeNull()
    expect(withSuggestions(mini, { title: "x", products: [] })).toEqual({
      ...mini,
      suggestions: { title: "x", products: [] },
    })
  })
})
