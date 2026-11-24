import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreProduct } from "@qticaret/types"

// `catalog.collections` off: a collection's rail shows nothing, its page is not found
const product = (id: string): StoreProduct =>
  ({ id, title: `Ürün ${id}`, handle: id, images: [], variants: [] }) as unknown as StoreProduct

const requests = vi.hoisted(() => ({
  allCategories: vi.fn(),
  listProducts: vi.fn(),
  pathsOf: vi.fn(() => Promise.resolve({})),
  priceDisplays: vi.fn(() => Promise.resolve({})),
  storefrontSettings: vi.fn(),
}))
vi.mock("server-only", () => ({}))
vi.mock("@/lib/store-api/requests", () => requests)
vi.mock("@/lib/store-api/extras", () => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
}))
vi.mock("@/lib/store-api/server", () => ({ storeGet: vi.fn() }))

const { collectionsOn } = await import("../collections-on")
const { railProducts, relatedProducts } = await import("../section-data")

const frame = (collections: boolean | undefined) =>
  requests.storefrontSettings.mockResolvedValue({
    features: {
      gift_cards: false,
      product_addons: false,
      ...(collections === undefined ? {} : { collections }),
    },
  })

describe("collections on the storefront", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requests.listProducts.mockResolvedValue({ products: [product("prod_1")], count: 1 })
  })

  it("reads the frame's flag; a backend without it means on", async () => {
    frame(true)
    expect(await collectionsOn()).toBe(true)
    frame(undefined)
    expect(await collectionsOn()).toBe(true)
    frame(false)
    expect(await collectionsOn()).toBe(false)
  })

  it("fills a collection's rail while on", async () => {
    frame(true)
    const products = await railProducts({
      source: { kind: "collection", collection_id: "pcol_1" },
      limit: 4,
    })
    expect(products.map((each) => each.id)).toEqual(["prod_1"])
    expect(requests.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ collectionIds: ["pcol_1"] })
    )
  })

  it("leaves a collection's rail and related rail empty while off, other sources untouched", async () => {
    frame(false)
    const rail = await railProducts({
      source: { kind: "collection", collection_id: "pcol_1" },
      limit: 4,
    })
    const related = await relatedProducts({ kind: "collection", collection_id: "pcol_1" }, 4, {
      id: "prod_9",
      categoryIds: [],
    })
    expect(rail).toEqual([])
    expect(related).toEqual([])
    expect(requests.listProducts).not.toHaveBeenCalled()

    const newest = await railProducts({ source: { kind: "newest" }, limit: 4 })
    expect(newest.map((each) => each.id)).toEqual(["prod_1"])
  })
})
