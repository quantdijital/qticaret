import { beforeEach, describe, expect, it, vi } from "vitest"
import type { StoreCategorySection, StoreProduct, StoreProductSection } from "@qticaret/types"
import { SCROLLER_DEFAULTS } from "@qticaret/types/section-scroller"
import { t } from "@/lib/i18n"
import type { ProductQuery } from "@/lib/store-api/requests"

// The Store API as the sections ask it: a small catalogue, every product with a path
const requests = vi.hoisted(() => ({
  listProducts: vi.fn(),
  pathsOf: vi.fn((_type: string, ids: readonly string[]) =>
    Promise.resolve(Object.fromEntries(ids.map((id) => [id, `/urun/${id}`])))
  ),
  priceDisplays: vi.fn(() => Promise.resolve({})),
  // No theme settings: the cards show what they always did (adr/0053 §B)
  storefrontSettings: vi.fn(() => Promise.resolve({ storefront: { primary_color: null } })),
  // The published design, no theme of its own: the frame\'s theme stands (adr/0063 §3)
  storefrontLayout: vi.fn(() => Promise.resolve({})),
}))
vi.mock("@/lib/store-api/requests", () => requests)
// A request without a preview: the theme is the published design's (adr/0063 §3)
vi.mock("next/headers", () => ({ headers: () => Promise.resolve(new Headers()) }))
// No card facts, category pictures or customer photos: an older backend's answers (adr/0046 Ek 2026-11-04)
vi.mock("@/lib/store-api/extras", () => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
}))

const { byPlacement, sectionViews, showsOwnCategory } = await import("../sections")

const product = (id: string): StoreProduct => ({
  id,
  title: id,
  handle: id,
  subtitle: null,
  description: null,
  thumbnail: null,
  variants: [],
})

const CATALOGUE = ["p1", "p2", "p3", "p4", "p5", "p6"].map(product)

/** `listProducts` over the catalogue: by ids (in the catalogue's order), else the first `limit`. */
function listFromCatalogue(query: ProductQuery) {
  const ids = query.ids
  const found = ids ? CATALOGUE.filter((each) => ids.includes(each.id)) : CATALOGUE
  const products = found.slice(0, query.limit)
  return Promise.resolve({ products, count: products.length })
}

const related = (
  source: Extract<StoreProductSection, { type: "related_products" }>["source"],
  limit: number,
  title: string | null = null
): StoreProductSection => ({
  id: "rel",
  type: "related_products",
  title,
  source,
  limit,
  columns: 3,
})

const onProduct = { product: { id: "p2", categoryIds: ["cat_knives", "cat_other"] } }

const productIds = (views: Awaited<ReturnType<typeof sectionViews>>) =>
  views.flatMap((view) => (view.type === "products" ? view.products.map((card) => card.id) : []))

beforeEach(() => {
  requests.listProducts.mockReset()
  requests.listProducts.mockImplementation(listFromCatalogue)
})

describe("a related products section under a product", () => {
  it("takes the product's first category, leaves the product out and keeps to the limit", async () => {
    const views = await sectionViews([related({ kind: "same_category" }, 3)], t, onProduct)

    expect(requests.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ categoryIds: ["cat_knives"], limit: 4 })
    )
    expect(productIds(views)).toEqual(["p1", "p3", "p4"])
    expect(views[0]).toMatchObject({
      type: "products",
      title: "Benzer ürünler",
      more: null,
      columns: 3,
    })
    expect(views[0]).not.toHaveProperty("phoneColumns")
  })

  it("passes one card on a phone on when the shop asks (bilesen-denetimi (b) 3)", async () => {
    const section = { ...related({ kind: "same_category" }, 3), columns_mobile: 1 as const }
    const views = await sectionViews([section], t, onProduct)

    expect(views[0]).toMatchObject({ type: "products", columns: 3, phoneColumns: 1 })
  })

  it("slides as a carousel with its scroller and draws its own cards (bilesen-denetimi (b) 7)", async () => {
    const section = {
      ...(related({ kind: "same_category" }, 3) as Extract<
        StoreProductSection,
        { type: "related_products" }
      >),
      variant: "carousel" as const,
      scroller: { ...SCROLLER_DEFAULTS, arrows: "hover" as const },
      card_variant: "framed" as const,
      columns_mobile: 1 as const,
    }
    const [view] = await sectionViews([section], t, onProduct)

    expect(view).toMatchObject({
      type: "products",
      variant: "carousel",
      scroller: { ...SCROLLER_DEFAULTS, arrows: "hover" },
    })
    expect(view).not.toHaveProperty("columns")
    expect(view).not.toHaveProperty("phoneColumns")
    const cards = view?.type === "products" ? view.products : []
    expect(cards.every((card) => card.variant === "framed")).toBe(true)
  })

  it("reads a variant or a card it does not know as the grid and the theme's card", async () => {
    const section = {
      ...(related({ kind: "same_category" }, 3) as Extract<
        StoreProductSection,
        { type: "related_products" }
      >),
      variant: "mosaic" as never,
      card_variant: "tall" as never,
    }
    const [view] = await sectionViews([section], t, onProduct)

    expect(view).toMatchObject({ type: "products", columns: 3 })
    expect(view).not.toHaveProperty("variant")
    const cards = view?.type === "products" ? view.products : []
    expect(cards.some((card) => card.variant === "framed")).toBe(false)
  })

  it("leaves the product out of a collection's rail too, in the shop's words", async () => {
    const views = await sectionViews(
      [related({ kind: "collection", collection_id: "pcol_1" }, 2, "Setin parçaları")],
      t,
      onProduct
    )

    expect(requests.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ collectionIds: ["pcol_1"], limit: 3 })
    )
    expect(productIds(views)).toEqual(["p1", "p3"])
    expect(views[0]).toMatchObject({ title: "Setin parçaları" })
  })

  it("keeps a hand-picked list's order, without the product, up to the limit", async () => {
    const views = await sectionViews(
      [related({ kind: "manual", product_ids: ["p5", "p2", "p1", "p4"] }, 2)],
      t,
      onProduct
    )

    expect(requests.listProducts).toHaveBeenCalledWith(
      expect.objectContaining({ ids: ["p5", "p1"] })
    )
    expect(productIds(views)).toEqual(["p5", "p1"])
  })

  it("is left out when there is nothing else to show, or no product to relate to", async () => {
    const alone = await sectionViews(
      [related({ kind: "manual", product_ids: ["p2"] }, 4)],
      t,
      onProduct
    )
    const uncategorised = await sectionViews([related({ kind: "same_category" }, 4)], t, {
      product: { id: "p2", categoryIds: [] },
    })
    const nowhere = await sectionViews([related({ kind: "same_category" }, 4)], t)

    expect([alone, uncategorised, nowhere]).toEqual([[], [], []])
    expect(requests.listProducts).not.toHaveBeenCalled()
  })

  it("replaces the storefront's own similar products only when it shows the same category", () => {
    expect(showsOwnCategory([related({ kind: "same_category" }, 4)])).toBe(true)
    expect(showsOwnCategory([related({ kind: "collection", collection_id: "pcol_1" }, 4)])).toBe(
      false
    )
    expect(showsOwnCategory([])).toBe(false)
  })
})

describe("a FAQ section", () => {
  it("passes its questions on as they are, its title left to the theme when the shop gave none", async () => {
    const items = [{ question: "Kargo ne zaman?", answer: "1–3 iş günü." }]

    const views = await sectionViews([{ id: "sss", type: "faq", title: null, items }], t)

    expect(views).toEqual([
      {
        id: "sss",
        type: "faq",
        title: null,
        items,
        settings: { open_first: "off", single_open: "off" },
      },
    ])
  })

  it("passes the shop's switches on, one off the list read as closed (bilesen-denetimi (b) 8)", async () => {
    const items = [{ question: "Kargo ne zaman?", answer: "1–3 iş günü." }]
    const section = { id: "sss", type: "faq", title: null, items, open_first: "on" } as const

    const [view] = await sectionViews([{ ...section, single_open: "always" as unknown as "on" }], t)

    expect(view).toMatchObject({ settings: { open_first: "on", single_open: "off" } })
  })
})

describe("a category page's sections", () => {
  it("split above and below the grid, in the shop's order", () => {
    const at = (id: string, placement: "top" | "bottom"): StoreCategorySection => ({
      id,
      type: "rich_text",
      title: null,
      html: "<p>x</p>",
      placement,
    })

    const { top, bottom } = byPlacement([
      at("a", "bottom"),
      at("b", "top"),
      at("c", "bottom"),
      at("d", "top"),
    ])

    expect(top.map((each) => each.id)).toEqual(["b", "d"])
    expect(bottom.map((each) => each.id)).toEqual(["a", "c"])
  })
})
