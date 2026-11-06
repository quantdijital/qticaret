import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreCategory, StoreImage, StoreProduct } from "@qticaret/types"
import { StoreApiError } from "@/lib/store-api/errors"

// `/kategoriler`: every top category and the ones right below it, each with a picture and a count
const category = (id: string, parent: string | null = null, rank = 0): StoreCategory => ({
  id,
  name: id,
  handle: id,
  description: null,
  parent_category_id: parent,
  rank,
})

const CATEGORIES = [
  category("pcat_a", null, 0),
  category("pcat_a1", "pcat_a"),
  category("pcat_a1x", "pcat_a1"),
  category("pcat_b", null, 1),
]
const PATHS = {
  pcat_a: "/kategori/a",
  pcat_a1: "/kategori/a/a1",
  pcat_a1x: "/kategori/a/a1/x",
  pcat_b: "/kategori/b",
}

const server = vi.hoisted(() => ({ storeGet: vi.fn(), storePublicGet: vi.fn() }))
vi.mock("@/lib/store-api/server", () => server)

const { categoryIndex } = await import("../category-index")

const product = (url: string): StoreProduct =>
  ({ id: "p", title: "Ürün", handle: "p", thumbnail: url, images: [] }) as unknown as StoreProduct

/** The answer to a request: the shop's total without a category, else one per category. */
const answer = (query: { category_id?: string[] }) => {
  const ids = query.category_id
  if (!ids) {
    return Promise.resolve({ products: [], count: 40 })
  }
  return Promise.resolve({
    products: [product(`/media/${ids[0] ?? ""}.jpg`)],
    count: ids.length * 10,
  })
}

const own: StoreImage = {
  url: "/media/kendi.jpg",
  alt: null,
  width: 800,
  height: 1000,
  derivatives: null,
}

describe("categoryIndex", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    server.storePublicGet.mockImplementation((_path: string, query: { category_id?: string[] }) =>
      answer(query)
    )
  })

  it("counts every top category and the ones below it over their whole subtree", async () => {
    const index = await categoryIndex(CATEGORIES, PATHS, new Map())
    expect(index.total).toBe(40)
    const [a, b] = index.categories
    expect(a?.count).toBe(30)
    expect(a?.children[0]?.count).toBe(20)
    expect(b?.count).toBe(10)
    expect(server.storePublicGet).toHaveBeenCalledWith(
      "/store/products",
      expect.objectContaining({ category_id: ["pcat_a", "pcat_a1", "pcat_a1x"], limit: 1 })
    )
  })

  it("gives a category without the shop's picture its newest product's photo, and keeps the shop's own", async () => {
    const index = await categoryIndex(CATEGORIES, PATHS, new Map([["pcat_b", own]]))
    expect(index.categories[0]?.image).toMatchObject({ src: "/media/pcat_a.jpg", alt: "" })
    expect(index.categories[0]?.children[0]?.image).toMatchObject({ src: "/media/pcat_a1.jpg" })
    expect(index.categories[1]?.image?.src).toContain("kendi.jpg")
  })

  it("asks once per drawn category: the ones further down stay in the tree, uncounted", async () => {
    const index = await categoryIndex(CATEGORIES, PATHS, new Map())
    // Two top categories, one below, and the shop's total
    expect(server.storePublicGet).toHaveBeenCalledTimes(4)
    const deep = index.categories[0]?.children[0]?.children[0]
    expect(deep?.path).toBe("/kategori/a/a1/x")
    expect(deep?.count).toBeUndefined()
  })

  it("keeps a category's name alone, and no total, when the backend does not answer", async () => {
    server.storePublicGet.mockRejectedValue(new StoreApiError(503, "unavailable", null))
    const index = await categoryIndex(CATEGORIES, PATHS, new Map())
    expect(index.total).toBeNull()
    expect(index.categories[0]?.count).toBeUndefined()
    expect(index.categories[0]?.image).toBeUndefined()
  })
})
