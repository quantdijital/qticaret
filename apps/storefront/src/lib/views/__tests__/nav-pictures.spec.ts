import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreCategory, StoreProduct } from "@qticaret/types"
import type { NavCategoryView } from "@qticaret/ui"
import { StoreApiError } from "@/lib/store-api/errors"

// The menu's top entries: the newest product's photo where the shop gave no picture
const category = (id: string, parent: string | null = null): StoreCategory => ({
  id,
  name: id,
  handle: id,
  description: null,
  parent_category_id: parent,
  rank: 0,
})

const CATEGORIES = [category("pcat_a"), category("pcat_a1", "pcat_a"), category("pcat_b")]
const PATHS = { pcat_a: "/kategori/a", pcat_a1: "/kategori/a/a1", pcat_b: "/kategori/b" }

const server = vi.hoisted(() => ({ storeGet: vi.fn(), storePublicGet: vi.fn() }))
vi.mock("@/lib/store-api/server", () => server)

const { withNavPictures } = await import("../nav-pictures")

const entry = (path: string, over: Partial<NavCategoryView> = {}): NavCategoryView => ({
  label: path,
  path,
  children: [],
  ...over,
})

const product = (url: string): StoreProduct =>
  ({ id: "p", title: "Ürün", handle: "p", thumbnail: url, images: [] }) as unknown as StoreProduct

describe("withNavPictures", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    server.storePublicGet.mockResolvedValue({ products: [product("/media/yeni.jpg")] })
  })

  it("gives a category's entry its newest product's photo, from its whole subtree", async () => {
    const [first] = await withNavPictures([entry("/kategori/a")], CATEGORIES, PATHS)
    expect(first?.image).toMatchObject({ src: "/media/yeni.jpg", alt: "" })
    expect(server.storePublicGet).toHaveBeenCalledWith(
      "/store/products",
      expect.objectContaining({ category_id: ["pcat_a", "pcat_a1"], limit: 1 })
    )
  })

  it("keeps the shop's own picture, and an entry that is no category's page as it is", async () => {
    const own = {
      src: "/media/kendi.jpg",
      alt: "",
      width: 1,
      height: 1,
      sources: { avif: null, webp: null },
    }
    const menu = await withNavPictures(
      [entry("/kategori/b", { image: own }), entry("/hakkimizda")],
      CATEGORIES,
      PATHS
    )
    expect(menu[0]?.image?.src).toBe("/media/kendi.jpg")
    expect(menu[1]?.image).toBeUndefined()
    expect(server.storePublicGet).not.toHaveBeenCalled()
  })

  it("leaves an entry without a picture when none has a photo or the backend does not answer", async () => {
    server.storePublicGet.mockRejectedValueOnce(new StoreApiError(503, "unavailable", null))
    server.storePublicGet.mockResolvedValueOnce({ products: [] })
    const menu = await withNavPictures(
      [entry("/kategori/a"), entry("/kategori/b")],
      CATEGORIES,
      PATHS
    )
    expect(menu.map((each) => each.image)).toEqual([undefined, undefined])
  })
})
