import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreLayoutSection, StoreProduct } from "@qticaret/types"
import { SCROLLER_DEFAULTS } from "@qticaret/types/section-scroller"

// A product rail's variants (adr/0049 Ek 2026-11-15): counts, cards and settings by variant
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
  pathsOf: vi.fn((_kind: string, ids: string[]) =>
    Promise.resolve(Object.fromEntries(ids.map((id) => [id, `/urun/${id}`])))
  ),
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

describe("a product rail's variants (adr/0049 Ek 2026-11-15)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requests.storefrontSettings.mockResolvedValue({
      theme: {},
      storefront: { primary_color: null },
    })
    requests.listProducts.mockImplementation(({ ids, limit }: { ids?: string[]; limit: number }) =>
      Promise.resolve({
        products: (
          ids ?? [
            "prod_1",
            "prod_2",
            "prod_3",
            "prod_4",
            "prod_5",
            "prod_6",
            "prod_7",
            "prod_8",
            "prod_9",
          ]
        )
          .slice(0, limit)
          .map(product),
        count: 0,
      })
    )
  })

  it("reads a rail from before variants as a grid, and one it does not know as a grid", async () => {
    const [old, unknown] = await sectionViews(
      [
        rail({ kind: "newest" }),
        rail({ kind: "newest" }, { id: "raf0002", variant: "mosaic" as never }),
      ],
      t
    )
    expect(old).toMatchObject({ variant: "grid", columns: 3 })
    expect(old).not.toHaveProperty("phoneColumns")
    expect(unknown).toMatchObject({ variant: "grid" })
  })

  it("passes a grid's one card on a phone on, and no other variant's (bilesen-denetimi (b) 3)", async () => {
    const [grid, carousel] = await sectionViews(
      [
        rail({ kind: "newest" }, { columns_mobile: 1 }),
        rail({ kind: "newest" }, { id: "raf0002", variant: "carousel", columns_mobile: 1 }),
      ],
      t
    )
    expect(grid).toMatchObject({ variant: "grid", phoneColumns: 1 })
    expect(carousel).not.toHaveProperty("phoneColumns")
  })

  it("passes a rail set apart from the tabs on, and nothing for one that joins (bilesen-denetimi (b) 2)", async () => {
    const [apart, joins, unknown] = await sectionViews(
      [
        rail({ kind: "newest" }, { tabs: "off" }),
        rail({ kind: "newest" }, { id: "raf0002" }),
        rail({ kind: "newest" }, { id: "raf0003", tabs: "maybe" as never }),
      ],
      t
    )
    expect(apart).toMatchObject({ tabs: "off" })
    expect(joins).not.toHaveProperty("tabs")
    expect(unknown).not.toHaveProperty("tabs")
  })

  it("asks for seven on a featured rail, rows of three on a compact one drawn compact", async () => {
    const [featured, compact] = await sectionViews(
      [
        rail({ kind: "newest" }, { variant: "featured", limit: 12 }),
        rail({ kind: "newest" }, { id: "raf0002", variant: "compact", rows: 3 }),
      ],
      t
    )
    expect(featured).toMatchObject({ variant: "featured" })
    expect(featured && "products" in featured ? featured.products : []).toHaveLength(7)
    expect(compact).toMatchObject({ variant: "compact", rows: 3 })
    const cards = compact && "products" in compact ? compact.products : []
    expect(cards).toHaveLength(9)
    expect(cards.every((card) => card.variant === "compact")).toBe(true)
  })

  it("fills a carousel's settings, a step it does not know read as the default", async () => {
    const [carousel] = await sectionViews(
      [
        rail(
          { kind: "newest" },
          { variant: "carousel", scroller: { arrows: "hover", desktop: "nine" } as never }
        ),
      ],
      t
    )
    expect(carousel).toMatchObject({
      variant: "carousel",
      scroller: { ...SCROLLER_DEFAULTS, arrows: "hover" },
    })
  })

  it("puts a columns rail's lists side by side, each cut to its count, an empty one left out", async () => {
    const [columns] = await sectionViews(
      [
        rail(
          { kind: "newest" },
          {
            variant: "columns",
            title: "Yeni gelenler",
            per_list: 3,
            lists: [
              { title: null, source: { kind: "on_sale" }, product_ids: ["prod_8", "prod_9"] },
              { title: "Boş", source: { kind: "on_sale" }, product_ids: [] },
            ],
          }
        ),
      ],
      t
    )
    expect(columns).toMatchObject({ variant: "columns", title: "Yeni gelenler", perList: 3 })
    const lists = columns && "lists" in columns ? (columns.lists ?? []) : []
    expect(lists.map((list) => [list.title, list.products.map((card) => card.id)])).toEqual([
      ["Yeni gelenler", ["prod_1", "prod_2", "prod_3"]],
      ["home.on_sale", ["prod_8", "prod_9"]],
    ])
    expect(lists[0]?.products.every((card) => card.variant === "compact")).toBe(true)
    // Nothing moved: no list says its place
    expect(lists.some((list) => "at" in list)).toBe(false)
  })

  it("says each list's place in the design once one before it was left out (adr/0065 Faz 2b)", async () => {
    const [columns] = await sectionViews(
      [
        rail(
          { kind: "newest" },
          {
            variant: "columns",
            title: "Yeni gelenler",
            lists: [
              { title: "Boş", source: { kind: "on_sale" }, product_ids: [] },
              { title: null, source: { kind: "on_sale" }, product_ids: ["prod_8"] },
            ],
          }
        ),
      ],
      t
    )
    const lists = columns && "lists" in columns ? (columns.lists ?? []) : []
    expect(lists.map((list) => list.at)).toEqual([0, 2])
  })
})
