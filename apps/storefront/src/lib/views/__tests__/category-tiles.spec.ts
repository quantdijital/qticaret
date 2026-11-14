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
const server = vi.hoisted(() => ({ storeGet: vi.fn(), storePublicGet: vi.fn() }))
vi.mock("@/lib/store-api/server", () => server)

const { categoryLinks } = await import("../section-data")
const { categoryTiles, picturedCategories } = await import("../category-tiles")

/** The category ids a photo was asked for, in the order asked. */
const asked = () =>
  server.storePublicGet.mock.calls.map(
    ([, query]) => (query as { category_id: string[] }).category_id
  )

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
    server.storePublicGet.mockImplementation(
      (_path: string, { category_id }: { category_id: string[] }) =>
        Promise.resolve({
          products: category_id.includes("pcat_a") ? [product("p1", "/media/caki.jpg")] : [],
        })
    )
  })

  it("gives a category without a picture its newest product's photo, from its whole subtree", async () => {
    const tiles = await categoryTiles([])
    expect(tiles.map((tile) => tile.label)).toEqual(["Çakılar", "Kılıçlar", "Aksesuar"])
    expect(tiles[0]?.image).toMatchObject({ src: "/media/caki.jpg", alt: "" })
    // The same answer for every visitor, kept a minute: no price, no session
    expect(server.storePublicGet).toHaveBeenCalledWith(
      "/store/products",
      expect.objectContaining({
        category_id: ["pcat_a", "pcat_a1"],
        limit: 1,
        order: "-created_at",
      })
    )
    expect(requests.listProducts).not.toHaveBeenCalled()
  })

  it("keeps the shop's own picture and asks nothing for it", async () => {
    const tiles = await categoryTiles([])
    expect(tiles[1]?.image?.src).toBe("/media/kilic.jpg")
    expect(asked()).not.toContainEqual(["pcat_b"])
  })

  it("gives every tile its photo, past eight too, a few requests at a time", async () => {
    const many = Array.from({ length: 13 }, (_, index) =>
      category(`pcat_${String(index)}`, `K${String(index)}`, index)
    )
    requests.allCategories.mockResolvedValue(many)
    extras.categoryImages.mockResolvedValue(new Map())
    let open = 0
    let most = 0
    server.storePublicGet.mockImplementation(async () => {
      open++
      most = Math.max(most, open)
      await new Promise((resolve) => setTimeout(resolve, 1))
      open--
      return { products: [product("p", "/media/x.jpg")] }
    })
    const tiles = await categoryTiles([])
    expect(tiles).toHaveLength(13)
    expect(tiles.every((tile) => tile.image?.src === "/media/x.jpg")).toBe(true)
    expect(most).toBeLessThanOrEqual(6)
    expect(most).toBeGreaterThan(1)
  })

  it("keeps only as many as the limit, and asks photos for those only", async () => {
    extras.categoryImages.mockResolvedValue(new Map())
    const kept = await picturedCategories([], 1)
    expect(kept.map(({ id }) => id)).toEqual(["pcat_a"])
    expect(asked()).toEqual([["pcat_a", "pcat_a1"]])
  })

  it("leaves a category with no pictured product, or an unanswered one, without a picture", async () => {
    server.storePublicGet.mockImplementation(
      (_path: string, { category_id }: { category_id: string[] }) =>
        category_id.includes("pcat_a")
          ? Promise.reject(new StoreApiError(503, "unavailable", null))
          : Promise.resolve({ products: [] })
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
