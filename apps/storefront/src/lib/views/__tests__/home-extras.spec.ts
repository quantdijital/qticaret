import { beforeEach, describe, expect, it, vi } from "vitest"
import type {
  StoreAttributeValue,
  StoreLayoutSection,
  StoreProduct,
  StoreReviewSummary,
} from "@qticaret/types"
import { t } from "@/lib/i18n"
import { StoreApiError } from "@/lib/store-api/errors"

// adr/0046 Ek 2026-11-05: one product up close, and the shop's reviews in short
const requests = vi.hoisted(() => ({
  productById: vi.fn(),
  pathsOf: vi.fn((_type: string, ids: readonly string[]) =>
    Promise.resolve(Object.fromEntries(ids.map((id) => [id, `/urun/${id}`])))
  ),
  priceDisplays: vi.fn(() => Promise.resolve({})),
  storefrontSettings: vi.fn(() => Promise.resolve({ storefront: { primary_color: null } })),
}))
vi.mock("@/lib/store-api/requests", () => requests)
const extras = vi.hoisted(() => ({
  cardFacts: vi.fn(() => Promise.resolve({})),
  categoryImages: vi.fn(() => Promise.resolve(new Map())),
  latestReviewPhotos: vi.fn(() => Promise.resolve([])),
  reviewSummary: vi.fn((): Promise<StoreReviewSummary["rating"]> => Promise.resolve(null)),
}))
vi.mock("@/lib/store-api/extras", () => extras)
const server = vi.hoisted(() => ({ storeGet: vi.fn() }))
vi.mock("@/lib/store-api/server", () => server)

const { sectionViews } = await import("../sections")
const { shopRatingView } = await import("../card-extras")

const attribute = (key: string, label: string, highlight: boolean): StoreAttributeValue => ({
  id: `atval_${key}`,
  value_text: `${label} değeri`,
  value_number: null,
  value_boolean: null,
  value_options: null,
  definition: {
    key,
    label,
    type: "text",
    unit: null,
    rank: 0,
    options: null,
    is_seo_highlight: highlight,
    group: null,
  },
})

const PRODUCT: StoreProduct = {
  id: "prod_1",
  title: "Şef Bıçağı",
  handle: "sef-bicagi",
  subtitle: "El yapımı",
  description: null,
  thumbnail: null,
  variants: [
    {
      id: "variant_1",
      title: "Standart",
      sku: null,
      manage_inventory: false,
      allow_backorder: false,
      inventory_quantity: null,
      calculated_price: { calculated_amount: 1749, original_amount: 1749, currency_code: "try" },
    },
  ],
  attribute_values: [attribute("steel", "Çelik", true), attribute("care", "Bakım", false)],
}

const featured: StoreLayoutSection = {
  id: "yakin",
  type: "featured_product",
  title: null,
  text: "Mutfağın en çok kullanılanı.",
  product_id: "prod_1",
}

beforeEach(() => {
  requests.productById.mockReset()
  requests.priceDisplays.mockReset()
  requests.priceDisplays.mockImplementation(() => Promise.resolve({}))
})

describe("a featured product section", () => {
  it("carries the card at the shopper's price, the headline facts and the spec table", async () => {
    requests.productById.mockResolvedValue(PRODUCT)
    requests.priceDisplays.mockImplementation(() =>
      Promise.resolve({
        variant_1: {
          current: "1224.30",
          regular: "1749.00",
          before: "1749.00",
          on_sale: true,
          since: null,
          basis: "regular",
          rule_version: "tr-10d-1",
        },
      })
    )
    const [view] = await sectionViews([featured], t)
    expect(view).toMatchObject({
      id: "yakin",
      type: "featured_product",
      title: null,
      text: "Mutfağın en çok kullanılanı.",
      subtitle: "El yapımı",
      product: {
        id: "prod_1",
        path: "/urun/prod_1",
        price: { current: "1.224,30 TL", before: "1.749,00 TL", discount: 30 },
      },
      facts: [{ label: "Çelik", value: "Çelik değeri", highlight: true }],
      specGroups: [{ title: null, rows: [{ label: "Bakım" }, { label: "Çelik" }] }],
    })
  })

  it("is left out when its product has no live page now", async () => {
    requests.productById.mockRejectedValue(new StoreApiError(404, "not_found", null))
    expect(await sectionViews([featured], t)).toEqual([])
  })
})

describe("the reviews section and the shop's rating", () => {
  const reviews: StoreLayoutSection = { id: "yorum", type: "reviews", title: null, limit: 3 }

  it("puts the shop's average, count and spread above the newest reviews", async () => {
    server.storeGet.mockResolvedValue({
      reviews: [
        {
          product_id: "prod_1",
          product_title: "Şef Bıçağı",
          rating: 5,
          title: null,
          body: "Çok keskin.",
          author_name: "Ayşe Y.",
          created_at: "2026-11-01T10:00:00.000Z",
          verified_purchase: true,
        },
      ],
    })
    extras.reviewSummary.mockResolvedValue({
      average: 4.6,
      count: 5,
      distribution: { "5": 3, "4": 2, "3": 0, "2": 0, "1": 0 },
    })
    const [view] = await sectionViews([reviews], t)
    expect(view).toMatchObject({
      type: "reviews",
      summary: {
        average: "4,6",
        count: 5,
        label: "5 üzerinden 4,6 (5 değerlendirme)",
        distribution: [
          { stars: 5, count: 3, percent: 60 },
          { stars: 4, count: 2, percent: 40 },
          { stars: 3, count: 0 },
          { stars: 2, count: 0 },
          { stars: 1, count: 0 },
        ],
      },
    })
  })

  it("leaves the summary out without an answer or a review", () => {
    expect(shopRatingView(null, t)).toBeNull()
    expect(
      shopRatingView(
        { average: 0, count: 0, distribution: { "5": 0, "4": 0, "3": 0, "2": 0, "1": 0 } },
        t
      )
    ).toBeNull()
    expect(
      shopRatingView(
        { average: 4, count: 1, distribution: { "5": 0, "4": 1, "3": 0, "2": 0, "1": 0 } },
        t
      )
    ).toMatchObject({ average: "4,0", count: 1 })
  })
})
