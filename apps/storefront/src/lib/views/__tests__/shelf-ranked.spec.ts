import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreLayoutSection, StoreProduct } from "@qticaret/types"

// A product rail's ranked variant (adr/0049 Ek 2026-11-16): its count, its layout, its places' price
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
  variant: "ranked",
  title: null,
  source: { kind: "newest" },
  limit: 12,
  more: null,
  ...more,
})

const t = (key: string) => key
const productsOf = (view: unknown) =>
  view && typeof view === "object" && "products" in view
    ? (view as { products: { path: string; variant?: string; framed?: unknown }[] }).products
    : []

describe("a product rail drawn as a ranked list (adr/0049 Ek 2026-11-16)", () => {
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

  it("asks for its own count, not the shop's limit, and passes its layout on", async () => {
    const [five, ten] = await sectionViews(
      [rail(), rail({ id: "raf0002", ranked_count: 10, ranked_layout: "row" })],
      t
    )
    expect(five).toMatchObject({ variant: "ranked", rankedLayout: "lead" })
    expect(productsOf(five)).toHaveLength(5)
    expect(ten).toMatchObject({ variant: "ranked", rankedLayout: "row" })
    expect(productsOf(ten)).toHaveLength(10)
  })

  it("keeps its source's order and prices its places as every card is priced", async () => {
    const [ranked] = await sectionViews([rail({ ranked_count: 3 })], t)
    expect(requests.priceDisplays).toHaveBeenCalledWith(["var_prod_1", "var_prod_2", "var_prod_3"])
    const cards = productsOf(ranked)
    expect(cards.map((card) => card.path)).toEqual(["/urun/prod_1", "/urun/prod_2", "/urun/prod_3"])
    // Drawn from the card's parts: compact asks the least, no framed card's extras
    expect(cards.every((card) => card.variant === "compact" && !card.framed)).toBe(true)
  })

  it("reads an unknown layout or count as its default", async () => {
    const [ranked] = await sectionViews(
      [rail({ ranked_count: 12 as never, ranked_layout: "grid" as never })],
      t
    )
    expect(ranked).toMatchObject({ rankedLayout: "lead" })
    expect(productsOf(ranked)).toHaveLength(5)
  })

  it("passes no layout to another variant", async () => {
    const [grid] = await sectionViews([rail({ variant: "grid", ranked_layout: "row" })], t)
    expect(grid).not.toHaveProperty("rankedLayout")
  })
})
