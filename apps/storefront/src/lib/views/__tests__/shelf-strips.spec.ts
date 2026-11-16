import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreLayoutSection, StoreProduct } from "@qticaret/types"
import { SHELF_STRIPS_DEFAULTS } from "@qticaret/types/section-strips"

// A product rail's strips variant (adr/0049 Ek 2026-11-16): its count, its cards' price, its look
const product = (id: string): StoreProduct =>
  ({
    id,
    title: `Ürün ${id}`,
    handle: id,
    thumbnail: null,
    images: [],
    variants: [{ id: `var_${id}`, title: "Tek", calculated_price: null, inventory_quantity: 3 }],
  }) as unknown as StoreProduct

const IDS = Array.from({ length: 12 }, (_, at) => `prod_${String(at + 1)}`)

const requests = vi.hoisted(() => ({
  allCategories: vi.fn(),
  listProducts: vi.fn(),
  pathsOf: vi.fn((_kind: string, ids: string[]) =>
    Promise.resolve(Object.fromEntries(ids.map((id) => [id, `/urun/${id}`])))
  ),
  priceDisplays: vi.fn<(ids: string[]) => Promise<object>>(() => Promise.resolve({})),
  legalIdentity: vi.fn(),
  siteSeo: vi.fn(),
  storefrontSettings: vi.fn(),
  storefrontLayout: vi.fn(() => Promise.resolve({})),
}))
vi.mock("@/lib/store-api/requests", () => requests)
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

const rail = (more: Partial<Rail> = {}): Rail => ({
  id: "raf0001",
  type: "products",
  variant: "strips",
  title: null,
  source: { kind: "newest" },
  limit: 12,
  more: null,
  ...more,
})

const t = (key: string) => key

describe("a product rail drawn as strips (adr/0049 Ek 2026-11-16)", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requests.storefrontSettings.mockResolvedValue({
      theme: {},
      storefront: { primary_color: null },
    })
    requests.listProducts.mockImplementation(({ ids, limit }: { ids?: string[]; limit: number }) =>
      Promise.resolve({ products: (ids ?? IDS).slice(0, limit).map(product), count: 0 })
    )
  })

  it("asks for its own count, not the shop's limit, and passes the look on", async () => {
    const [five, three] = await sectionViews(
      [
        rail(),
        rail({ id: "raf0002", strips_count: 3, strips_height: "low", strips_overlap: "on" }),
      ],
      t
    )
    expect(five).toMatchObject({ variant: "strips", strips: SHELF_STRIPS_DEFAULTS })
    expect(five && "products" in five ? five.products : []).toHaveLength(5)
    expect(three).toMatchObject({
      strips: { ...SHELF_STRIPS_DEFAULTS, strips_height: "low", strips_overlap: "on" },
    })
    expect(three && "products" in three ? three.products : []).toHaveLength(3)
  })

  it("prices its products as every card is priced, drawing no framed card's extras", async () => {
    const [strips] = await sectionViews([rail({ strips_count: 2 })], t)
    expect(requests.priceDisplays).toHaveBeenCalledWith(["var_prod_1", "var_prod_2"])
    const cards = strips && "products" in strips ? strips.products : []
    expect(cards.map((card) => card.path)).toEqual(["/urun/prod_1", "/urun/prod_2"])
    expect(cards.every((card) => card.variant === "compact" && !card.framed)).toBe(true)
  })

  it("reads an unknown step or count as its default", async () => {
    const [strips] = await sectionViews(
      [rail({ strips_count: 12 as never, strips_slant: "vertical" as never })],
      t
    )
    expect(strips).toMatchObject({ strips: { strips_slant: "medium" } })
    expect(strips && "products" in strips ? strips.products : []).toHaveLength(5)
  })

  it("passes no look to another variant", async () => {
    const [grid] = await sectionViews([rail({ variant: "grid", strips_count: 3 })], t)
    expect(grid).not.toHaveProperty("strips")
  })

  it("draws no sale rail with nothing on sale, as every variant", async () => {
    const views = await sectionViews([rail({ source: { kind: "on_sale" }, product_ids: [] })], t)
    expect(views).toEqual([])
  })
})
