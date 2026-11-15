import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreHeroCatalog, StoreProduct } from "@qticaret/types"
import { t } from "@/lib/i18n"
import type { ProductQuery } from "@/lib/store-api/requests"

// The Store API as the catalogue sections ask it: two products, every one with a path
const requests = vi.hoisted(() => ({
  listProducts: vi.fn(),
  pathsOf: vi.fn((type: string, ids: readonly string[]) =>
    Promise.resolve(
      Object.fromEntries(
        ids.map((id) => [id, type === "product_category" ? `/kategori/${id}` : `/urun/${id}`])
      )
    )
  ),
  // The categories the Store API shows: a hidden one is not among them
  allCategories: vi.fn(() =>
    Promise.resolve([
      {
        id: "pcat_kamp",
        name: "Kamp",
        handle: "kamp",
        description: null,
        parent_category_id: null,
      },
    ])
  ),
  priceDisplays: vi.fn(() => Promise.resolve({})),
  siteSeo: vi.fn(() => Promise.resolve({ shop: { name: "Atölye" } })),
}))
vi.mock("@/lib/store-api/requests", () => requests)
const extras = vi.hoisted(() => ({
  categoryCounts: vi.fn(() =>
    Promise.resolve(
      new Map([
        ["pcat_caki", 58],
        ["pcat_balta", 13],
      ])
    )
  ),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
}))
vi.mock("@/lib/store-api/extras", () => extras)
// Each category a card with its picture; the ids the section names, in its order
const tiles = vi.hoisted(() => ({
  picturedCategories: vi.fn((ids: readonly string[], limit?: number) =>
    Promise.resolve(
      (ids.length > 0 ? ids : ["pcat_caki", "pcat_balta", "pcat_kilic"])
        .slice(0, limit)
        .map((id) => ({ id, card: { label: id, path: `/kategori/${id}` } }))
    )
  ),
}))
vi.mock("../category-tiles", () => tiles)
const layout = vi.hoisted(() => ({
  currentMenus: vi.fn(() =>
    Promise.resolve([
      {
        title: "Ana menü",
        location: "main",
        rank: 0,
        items: [
          { kind: "category", target: "pcat_kilic", label: null, path: "/k", children: [] },
          { kind: "system", target: "shop", label: null, path: null, children: [] },
        ],
      },
    ])
  ),
  layoutLink: vi.fn((link: { label: string | null; path: string | null } | null) =>
    link?.path ? { label: link.label ?? "Bağlantı", path: link.path } : null
  ),
  layoutImage: vi.fn((image: { url: string }, alt: string) => ({
    src: image.url,
    alt,
    width: null,
    height: null,
    sources: { avif: null, webp: null },
  })),
}))
vi.mock("../layout", () => layout)

const { bandPath, heroCatalogView, priceBandsView } = await import("../catalog")

const product = (id: string, amount: number): StoreProduct => ({
  id,
  title: `Ürün ${id}`,
  handle: id,
  subtitle: null,
  description: null,
  thumbnail: null,
  variants: [
    {
      id: `${id}-v`,
      title: "Standart",
      calculated_price: { calculated_amount: amount },
    } as NonNullable<StoreProduct["variants"]>[number],
  ],
})

const CATALOGUE = [product("p1", 4249), product("p2", 3999)]

const section = (over: Partial<StoreHeroCatalog> = {}): StoreHeroCatalog => ({
  variant: "category_list",
  list: { kind: "top" },
  list_limit: 2,
  show_count: true,
  tiles: [{ category_id: "pcat_balta", image: null }],
  chips: [{ kind: "category", target: "pcat_kilic", label: "Kılıçlar", path: "/kategori/kilic" }],
  picks: [
    { product_id: "p1", label: "Yeşil" },
    { product_id: "p2", label: null },
  ],
  show_price: true,
  ...over,
})

beforeEach(() => {
  tiles.picturedCategories.mockClear()
  requests.listProducts.mockReset()
  requests.listProducts.mockImplementation((query: ProductQuery) => {
    const ids = query.ids ?? []
    const products = CATALOGUE.filter((each) => ids.includes(each.id))
    return Promise.resolve({ products, count: products.length })
  })
})

describe("the opening's category list (H17)", () => {
  it("lists the top categories up to its limit with their counts, a tile with its count", async () => {
    const view = await heroCatalogView(section(), t)

    expect(view.list.map((card) => [card.label, card.count])).toEqual([
      ["pcat_caki", 58],
      ["pcat_balta", 13],
    ])
    expect(view.tiles).toEqual([{ label: "pcat_balta", path: "/kategori/pcat_balta", count: 13 }])
    expect(view.all).toEqual({ label: "Tüm kategoriler", path: "/kategoriler" })
  })

  it("cuts the list to its limit before any category's photo is asked for", async () => {
    await heroCatalogView(section({ list_limit: 2 }), t)

    expect(tiles.picturedCategories).toHaveBeenCalledWith([], 2)
  })

  it("draws no tile and no quick link when there are none, and asks nothing for them", async () => {
    const view = await heroCatalogView(section({ tiles: [], chips: [] }), t)

    expect(view.tiles).toEqual([])
    expect(view.chips).toEqual([])
    // Only the list's own request: an empty pick never reads as "the top categories"
    expect(tiles.picturedCategories).toHaveBeenCalledTimes(1)
    expect(tiles.picturedCategories).toHaveBeenCalledWith([], 2)
  })

  it("lists nothing when a picked list's categories are all gone", async () => {
    const view = await heroCatalogView(
      section({ list: { kind: "manual", category_ids: [] }, tiles: [], chips: [] }),
      t
    )

    expect(view.list).toEqual([])
    expect(tiles.picturedCategories).not.toHaveBeenCalled()
  })

  it("shows no count when the shop turned counts off", async () => {
    const view = await heroCatalogView(section({ show_count: false }), t)

    expect(view.list.every((card) => card.count === undefined)).toBe(true)
  })

  it("takes the header menu's categories as the list when the shop chose the menu", async () => {
    const view = await heroCatalogView(section({ list: { kind: "menu" } }), t)

    expect(tiles.picturedCategories).toHaveBeenCalledWith(["pcat_kilic"], 2)
    expect(view.list.map((card) => card.label)).toEqual(["pcat_kilic"])
  })

  it("gives a category's quick link its picture, the picks their labels, and the lowest price", async () => {
    const view = await heroCatalogView(section(), t)

    expect(view.chips).toEqual([{ label: "Kılıçlar", path: "/kategori/kilic" }])
    expect(view.picks.map((pick) => [pick.label, pick.path])).toEqual([
      ["Yeşil", "/urun/p1"],
      ["Ürün p2", "/urun/p2"],
    ])
    expect(view.from).toBe("3.999,00 TL")
    expect((await heroCatalogView(section({ show_price: false }), t)).from).toBeNull()
    expect((await heroCatalogView(section({ picks: [] }), t)).from).toBeNull()
  })
})

describe("the price bands", () => {
  it("links each band to the catalogue filtered by its range", () => {
    expect(bandPath(null, 500)).toBe("/magaza?fiyat=-500")
    expect(bandPath(500, 1000)).toBe("/magaza?fiyat=500-1000")
    expect(bandPath(2500, null)).toBe("/magaza?fiyat=2500-")
  })

  it("links a band with a category to its page, filtered only when the band has a bound", () => {
    expect(bandPath(null, null, "/kategori/kamp")).toBe("/kategori/kamp")
    expect(bandPath(null, 1000, "/kategori/kamp")).toBe("/kategori/kamp?fiyat=-1000")
  })

  it("names a band's category and leaves out one the Store API does not show", async () => {
    const view = await priceBandsView(
      {
        id: "fiyat",
        type: "price_bands",
        title: "Bantlar",
        bands: [
          { label: "₺500 altı", text: null, min: null, max: 500, product_ids: ["p2"] },
          {
            label: "Kamp, ₺1.000'e kadar",
            text: null,
            category_id: "pcat_kamp",
            min: null,
            max: 1000,
            product_ids: [],
          },
          {
            label: "Kamp",
            text: "Hepsi",
            category_id: "pcat_kamp",
            min: null,
            max: null,
            product_ids: ["p1"],
          },
          {
            label: "Gizli",
            text: null,
            category_id: "pcat_gizli",
            min: null,
            max: null,
            product_ids: [],
          },
        ],
      },
      t
    )

    expect(view?.bands.map((band) => [band.label, band.category, band.path])).toEqual([
      ["₺500 altı", undefined, "/magaza?fiyat=-500"],
      ["Kamp, ₺1.000'e kadar", "Kamp", "/kategori/pcat_kamp?fiyat=-1000"],
      ["Kamp", "Kamp", "/kategori/pcat_kamp"],
    ])
    expect(view?.bands[2]?.products.map((each) => each.path)).toEqual(["/urun/p1"])
  })

  it("draws no strip when every band's category is hidden, and asks no category for price bands", async () => {
    const hidden = await priceBandsView(
      {
        id: "fiyat",
        type: "price_bands",
        title: null,
        bands: [
          {
            label: "Gizli",
            text: null,
            category_id: "pcat_gizli",
            min: null,
            max: null,
            product_ids: [],
          },
        ],
      },
      t
    )
    requests.allCategories.mockClear()
    await priceBandsView(
      {
        id: "fiyat",
        type: "price_bands",
        title: null,
        bands: [{ label: "A", text: null, min: null, max: 1, product_ids: [] }],
      },
      t
    )

    expect(hidden).toBeNull()
    expect(requests.allCategories).not.toHaveBeenCalled()
  })

  it("gives each band its products as picked, the storefront's title when the shop wrote none", async () => {
    const view = await priceBandsView(
      {
        id: "fiyat",
        type: "price_bands",
        title: null,
        bands: [
          { label: "₺500 altı", text: null, min: null, max: 500, product_ids: ["p2", "yok"] },
          { label: "Üstü", text: "Koleksiyon", min: 501, max: null, product_ids: ["p1"] },
        ],
      },
      t
    )

    expect(view?.title).toBe("Fiyata göre alışveriş")
    expect(view?.bands.map((band) => [band.path, band.products.map((each) => each.path)])).toEqual([
      ["/magaza?fiyat=-500", ["/urun/p2"]],
      ["/magaza?fiyat=501-", ["/urun/p1"]],
    ])
  })
})
