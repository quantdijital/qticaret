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

const { OTHER_PHOTOS, withNavPictures } = await import("../nav-pictures")

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

  it("gives the children their newest photo too, in their places, from their own subtree", async () => {
    const [first] = await withNavPictures(
      [entry("/kategori/a", { children: [{ label: "a1", path: "/kategori/a/a1" }] })],
      CATEGORIES,
      PATHS
    )
    expect(first?.image?.src).toBe("/media/yeni.jpg")
    expect(
      first?.children.map((child) => [child.label, child.image?.src, child.image?.alt])
    ).toEqual([["a1", "/media/yeni.jpg", ""]])
    expect(server.storePublicGet).toHaveBeenCalledWith(
      "/store/products",
      expect.objectContaining({ category_id: ["pcat_a1"] })
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

describe("withNavPictures: no photo twice among siblings", () => {
  const TREE = [
    category("pcat_a"),
    category("pcat_a1", "pcat_a"),
    category("pcat_a2", "pcat_a"),
    category("pcat_a3", "pcat_a"),
  ]
  const TREE_PATHS = {
    pcat_a: "/kategori/a",
    pcat_a1: "/kategori/a/a1",
    pcat_a2: "/kategori/a/a2",
    pcat_a3: "/kategori/a/a3",
  }
  const children = (...over: Partial<NavCategoryView>[]) =>
    entry("/kategori/a", {
      children: ["a1", "a2", "a3"].map((name, index) => ({
        label: name,
        path: `/kategori/a/${name}`,
        ...over[index],
      })),
    })
  const own = (src: string) => ({
    src,
    alt: "",
    width: 1,
    height: 1,
    sources: { avif: null, webp: null },
  })
  /** The newest product's photo for one, the newest few for a repeated one. */
  const answers = (newest: string, more: readonly string[]) =>
    server.storePublicGet.mockImplementation((_path: string, query: { limit: number }) =>
      Promise.resolve({
        products: query.limit === 1 ? [product(newest)] : more.map((url) => product(url)),
      })
    )

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("gives a child whose photo a sibling above shows its subtree's next newest one", async () => {
    answers("/media/ayni.jpg", ["/media/ayni.jpg", "/media/baska.jpg", "/media/ucuncu.jpg"])
    const [top] = await withNavPictures([children()], TREE, TREE_PATHS)
    expect(top?.children.map((child) => child.image?.src)).toEqual([
      "/media/ayni.jpg",
      "/media/baska.jpg",
      "/media/ucuncu.jpg",
    ])
    expect(server.storePublicGet).toHaveBeenCalledWith(
      "/store/products",
      expect.objectContaining({ category_id: ["pcat_a2"], limit: OTHER_PHOTOS })
    )
    // The parent is no sibling: its photo may be a child's
    expect(top?.image?.src).toBe("/media/ayni.jpg")
  })

  it("keeps the repeated photo when the data offers no other, never an invented one", async () => {
    answers("/media/ayni.jpg", ["/media/ayni.jpg"])
    const [top] = await withNavPictures([children()], TREE, TREE_PATHS)
    expect(top?.children.map((child) => child.image?.src)).toEqual([
      "/media/ayni.jpg",
      "/media/ayni.jpg",
      "/media/ayni.jpg",
    ])
  })

  it("looks past the shop's own picture repeated on a sibling, and leaves distinct ones alone", async () => {
    answers("/media/urun.jpg", ["/media/urun.jpg"])
    const [top] = await withNavPictures(
      [
        children(
          { image: own("/media/kapak.jpg") },
          { image: own("/media/kapak.jpg") },
          { image: own("/media/kendi.jpg") }
        ),
      ],
      TREE,
      TREE_PATHS
    )
    expect(top?.children.map((child) => child.image?.src)).toEqual([
      "/media/kapak.jpg",
      "/media/urun.jpg",
      "/media/kendi.jpg",
    ])
  })

  it("keeps the repeated photo when the backend does not answer the second question", async () => {
    server.storePublicGet.mockImplementation((_path: string, query: { limit: number }) =>
      query.limit === 1
        ? Promise.resolve({ products: [product("/media/ayni.jpg")] })
        : Promise.reject(new StoreApiError(503, "unavailable", null))
    )
    const [top] = await withNavPictures([children()], TREE, TREE_PATHS)
    expect(top?.children.map((child) => child.image?.src)).toEqual([
      "/media/ayni.jpg",
      "/media/ayni.jpg",
      "/media/ayni.jpg",
    ])
  })
})
