import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreLayoutSection, StoreProduct } from "@qticaret/types"
import { SHELF_STAGE_DEFAULTS } from "@qticaret/types/section-shelf"

// A product rail's stage list (adr/0049 Ek 2026-11-16): its count, its cards' price, its settings
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
  variant: "stage_list",
  title: null,
  source: { kind: "newest" },
  limit: 12,
  more: null,
  ...more,
})

const t = (key: string) => key

const cardsOf = (view: unknown) =>
  view && typeof view === "object" && "products" in view
    ? (view.products as { path: string; variant?: string; framed?: unknown }[])
    : []

describe("a product rail drawn as a stage list (adr/0049 Ek 2026-11-16)", () => {
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

  it("asks for its own count, not the shop's limit, and passes its settings on", async () => {
    const [four, six] = await sectionViews(
      [rail(), rail({ id: "raf0002", stage_count: 6, stage_side: "end", stage_follow: "off" })],
      t
    )
    expect(four).toMatchObject({ variant: "stage_list", stage: SHELF_STAGE_DEFAULTS })
    expect(cardsOf(four)).toHaveLength(4)
    expect(six).toMatchObject({
      stage: { stage_side: "end", stage_ground: "stage", stage_follow: "off" },
    })
    expect(cardsOf(six)).toHaveLength(6)
  })

  it("prices its products as every card is priced, drawing no framed card's extras", async () => {
    const [stage] = await sectionViews([rail({ stage_count: 3, card_variant: "framed" })], t)
    expect(requests.priceDisplays).toHaveBeenCalledWith(["var_prod_1", "var_prod_2", "var_prod_3"])
    const cards = cardsOf(stage)
    expect(cards.map((card) => card.path)).toEqual(["/urun/prod_1", "/urun/prod_2", "/urun/prod_3"])
    expect(cards.every((card) => card.variant === "compact" && !card.framed)).toBe(true)
  })

  it("reads an unknown step or count as its default", async () => {
    const [stage] = await sectionViews(
      [rail({ stage_count: 9 as never, stage_ground: "neon" as never })],
      t
    )
    expect(stage).toMatchObject({ stage: { stage_ground: "stage" } })
    expect(cardsOf(stage)).toHaveLength(4)
  })

  it("passes no stage settings to another variant", async () => {
    const [grid] = await sectionViews([rail({ variant: "grid", stage_count: 3 })], t)
    expect(grid).not.toHaveProperty("stage")
  })

  it("draws no sale rail with nothing on sale, as every variant", async () => {
    const views = await sectionViews([rail({ source: { kind: "on_sale" }, product_ids: [] })], t)
    expect(views).toEqual([])
  })
})
