import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreLayoutSection, StoreProduct } from "@qticaret/types"

// The home page's sale and best-seller rails: their products picked by the backend, loaded here
const product = (id: string): StoreProduct =>
  ({
    id,
    title: `Ürün ${id}`,
    handle: id,
    thumbnail: null,
    images: [],
    variants: [],
  }) as unknown as StoreProduct

const requests = vi.hoisted(() => ({
  allCategories: vi.fn(),
  listProducts: vi.fn(),
  pathsOf: vi.fn(() => Promise.resolve({})),
  priceDisplays: vi.fn(() => Promise.resolve({})),
  legalIdentity: vi.fn(),
  siteSeo: vi.fn(),
  storefrontSettings: vi.fn(),
  // The published design, no theme of its own: the frame\'s theme stands (adr/0063 §3)
  storefrontLayout: vi.fn(() => Promise.resolve({})),
}))
vi.mock("@/lib/store-api/requests", () => requests)
// A request without a preview: the theme is the published design's (adr/0063 §3)
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }))
vi.mock("@/lib/store-api/extras", () => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
  reviewSummary: vi.fn(),
}))
vi.mock("@/lib/store-api/server", () => ({ storeGet: vi.fn() }))
vi.mock("@/lib/store-api/blog", () => ({ blogPosts: vi.fn() }))

const { railProducts } = await import("../section-data")
const { sectionViews } = await import("../sections")

type Rail = Extract<StoreLayoutSection, { type: "products" }>

const rail = (source: Rail["source"], more: Partial<Rail> = {}): Rail => ({
  id: "raf0001",
  type: "products",
  title: null,
  source,
  limit: 4,
  columns: 3,
  more: null,
  ...more,
})

const t = (key: string) => key

describe("picked rails (adr/0049 Ek 2026-11-05)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // The store API answers in its own order, live products only
    requests.listProducts.mockImplementation(({ ids }: { ids: string[] }) =>
      Promise.resolve({
        products: ids
          .filter((id) => id !== "prod_gone")
          .map(product)
          .reverse(),
        count: 0,
      })
    )
  })

  it("loads a best-seller rail's products in the backend's order, skipping one gone since", async () => {
    const products = await railProducts(
      rail(
        { kind: "best_sellers", days: 90 },
        {
          product_ids: ["prod_b", "prod_gone", "prod_c", "prod_a", "prod_z"],
          filled_with_newest: true,
        }
      )
    )
    expect(products.map((each) => each.id)).toEqual(["prod_b", "prod_c", "prod_a"])
    // Never more than the rail shows
    expect(requests.listProducts).toHaveBeenCalledWith({
      limit: 4,
      ids: ["prod_b", "prod_gone", "prod_c", "prod_a"],
    })
  })

  it("loads a sale rail's products by id, and nothing for a pick it was not given", async () => {
    const sale = await railProducts(
      rail({ kind: "on_sale" }, { product_ids: ["prod_d", "prod_a"] })
    )
    expect(sale.map((each) => each.id)).toEqual(["prod_d", "prod_a"])
    expect(await railProducts(rail({ kind: "on_sale" }))).toEqual([])
    expect(requests.listProducts).toHaveBeenCalledTimes(1)
  })

  it("leaves out a sale rail while nothing is on sale, keeps an empty best-seller rail", async () => {
    const views = await sectionViews(
      [
        rail({ kind: "on_sale" }, { id: "indirim1", product_ids: [] }),
        rail({ kind: "best_sellers", days: 90 }, { id: "coksatan", product_ids: [] }),
      ],
      t
    )
    expect(views.map((view) => view.id)).toEqual(["coksatan"])
  })

  it("names an untitled rail by where its products come from, its cards in a row passed on", async () => {
    requests.pathsOf.mockResolvedValue({
      prod_a: "/urun/prod_a",
      prod_b: "/urun/prod_b",
      prod_c: "/urun/prod_c",
    })
    requests.storefrontSettings.mockResolvedValue({
      theme: {},
      storefront: { primary_color: null },
    })
    const views = await sectionViews(
      [
        rail(
          { kind: "best_sellers", days: 90 },
          { id: "coksatan", columns: 5, product_ids: ["prod_a"] }
        ),
        rail({ kind: "on_sale" }, { id: "indirim1", columns: 4, product_ids: ["prod_b"] }),
        rail({ kind: "on_sale" }, { id: "indirim2", title: "Kasım", product_ids: ["prod_c"] }),
      ],
      t
    )
    expect(views.map((view) => ("title" in view ? view.title : null))).toEqual([
      "home.best_sellers",
      "home.on_sale",
      "Kasım",
    ])
    // The shop's cards in a row on a wide screen (adr/0049 Ek 2026-11-05), 3 when it left it
    expect(views.map((view) => ("columns" in view ? view.columns : null))).toEqual([5, 4, 3])
  })
})
