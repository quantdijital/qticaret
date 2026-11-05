import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreCategory, StoreProduct } from "@qticaret/types"
import { StoreApiError } from "@/lib/store-api/errors"

// The home page's category cards: a product's photo where the category has no picture
const category = (
  id: string,
  name: string,
  rank: number,
  parent: string | null = null
): StoreCategory => ({ id, name, handle: id, description: null, parent_category_id: parent, rank })

const CATEGORIES = [
  category("pcat_a", "Çakılar", 0),
  category("pcat_a1", "Katlanır çakılar", 0, "pcat_a"),
  category("pcat_b", "Kılıçlar", 1),
  category("pcat_c", "Aksesuar", 2),
]

const product = (id: string, url: string | null): StoreProduct =>
  ({
    id,
    title: `Ürün ${id}`,
    handle: id,
    thumbnail: url,
    images: [],
    variants: [],
  }) as unknown as StoreProduct

const requests = vi.hoisted(() => ({
  allCategories: vi.fn(),
  listProducts: vi.fn(),
  pathsOf: vi.fn((_type: string, ids: readonly string[]) =>
    Promise.resolve(Object.fromEntries(ids.map((id) => [id, `/kategori/${id}`])))
  ),
  priceDisplays: vi.fn(() => Promise.resolve({})),
}))
vi.mock("@/lib/store-api/requests", () => requests)
const extras = vi.hoisted(() => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
}))
vi.mock("@/lib/store-api/extras", () => extras)
vi.mock("@/lib/store-api/server", () => ({ storeGet: vi.fn() }))

const { categoryLinks, categoryTiles } = await import("../section-data")

describe("categoryTiles", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requests.allCategories.mockResolvedValue(CATEGORIES)
    extras.categoryImages.mockResolvedValue(
      new Map([
        [
          "pcat_b",
          { url: "/media/kilic.jpg", alt: null, width: 800, height: 600, derivatives: null },
        ],
      ])
    )
    requests.listProducts.mockImplementation(({ categoryIds }: { categoryIds: string[] }) =>
      Promise.resolve({
        products: categoryIds.includes("pcat_a") ? [product("p1", "/media/caki.jpg")] : [],
        count: 0,
      })
    )
  })

  it("gives a category without a picture its newest product's photo, from its whole subtree", async () => {
    const tiles = await categoryTiles([])
    expect(tiles.map((tile) => tile.label)).toEqual(["Çakılar", "Kılıçlar", "Aksesuar"])
    expect(tiles[0]?.image).toMatchObject({ src: "/media/caki.jpg", alt: "" })
    expect(requests.listProducts).toHaveBeenCalledWith({
      limit: 1,
      order: "-created_at",
      categoryIds: ["pcat_a", "pcat_a1"],
    })
  })

  it("keeps the shop's own picture and asks nothing for it", async () => {
    const tiles = await categoryTiles([])
    expect(tiles[1]?.image?.src).toBe("/media/kilic.jpg")
    expect(requests.listProducts).not.toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ["pcat_b"] })
    )
  })

  it("leaves a category with no pictured product, or an unanswered one, without a picture", async () => {
    requests.listProducts.mockImplementation(({ categoryIds }: { categoryIds: string[] }) =>
      categoryIds.includes("pcat_a")
        ? Promise.reject(new StoreApiError(503, "unavailable", null))
        : Promise.resolve({ products: [], count: 0 })
    )
    const tiles = await categoryTiles([])
    expect(tiles[0]?.image).toBeUndefined()
    expect(tiles[2]?.image).toBeUndefined()
  })

  it("leaves the other pages' category cards as they were", async () => {
    const links = await categoryLinks([])
    expect(links[0]?.image).toBeUndefined()
    expect(requests.listProducts).not.toHaveBeenCalled()
  })
})
