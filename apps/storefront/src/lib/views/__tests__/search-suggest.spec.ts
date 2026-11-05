import { describe, expect, it } from "vitest"
import type { PriceDisplay, StoreProduct } from "@qticaret/types"
import type { SuggestAnswer } from "@/lib/store-api/listings"
import { emptySuggestion, suggestView, suggestWordsOf } from "../search-suggest"

const product = (id: string, title: string, amount: number): StoreProduct => ({
  id,
  title,
  handle: id,
  subtitle: null,
  description: null,
  thumbnail: `/media/${id}.jpg`,
  variants: [
    {
      id: `variant_${id}`,
      title: "Standart",
      sku: null,
      manage_inventory: false,
      allow_backorder: false,
      inventory_quantity: 0,
      options: [],
      calculated_price: {
        calculated_amount: amount,
        original_amount: amount,
        currency_code: "try",
      },
    },
  ],
})

const display = (current: string, before: string | null): PriceDisplay => ({
  current,
  regular: before ?? current,
  before,
  on_sale: before !== null,
  since: null,
  basis: "history",
  rule_version: "tr-10d-1",
})

const answer = (over: Partial<SuggestAnswer> = {}): SuggestAnswer => ({
  product_ids: ["p1", "p2", "p3"],
  count: 42,
  suggestions: ["çakı"],
  related: {
    categories: [
      { id: "pcat_1", name: "Çakılar" },
      { id: "pcat_2", name: "Gizli" },
    ],
    brands: [{ id: "brand_1", name: "Yatağan", handle: "yatagan" }],
  },
  ...over,
})

describe("the live search's words", () => {
  it("reads `/arama`'s way, runs of spaces as one, from two characters", () => {
    expect(suggestWordsOf(new URLSearchParams({ q: "  kemik   saplı " }))).toBe("kemik saplı")
    expect(suggestWordsOf(new URLSearchParams({ q: " ç " }))).toBeNull()
    expect(suggestWordsOf(new URLSearchParams())).toBeNull()
    expect(suggestWordsOf(new URLSearchParams({ q: "a".repeat(150) }))?.length).toBe(100)
  })
})

describe("the live search's panel view", () => {
  it("lists the hits in the search's order with their cards' prices, struck price included", () => {
    const view = suggestView({
      q: "çaki",
      answer: answer(),
      // The products arrive in any order; p3 has no live path
      products: [product("p2", "Kemik Saplı Çakı", 450), product("p1", "Katlanır Çakı", 875)],
      productPaths: { p1: "/urun/katlanir-caki", p2: "/urun/kemik-sapli-caki", p3: "/urun/x" },
      displays: {
        variant_p1: display("875.00", "1250.00"),
        variant_p2: display("450.00", null),
      },
      categoryPaths: { pcat_1: "/kategori/cakilar" },
    })
    expect(view.products.map((each) => [each.title, each.path, each.price])).toEqual([
      [
        "Katlanır Çakı",
        "/urun/katlanir-caki",
        {
          current: "875,00 TL",
          before: "1.250,00 TL",
          from: false,
          discount: 30,
          saving: "375,00 TL",
        },
      ],
      [
        "Kemik Saplı Çakı",
        "/urun/kemik-sapli-caki",
        { current: "450,00 TL", before: null, from: false, discount: null, saving: null },
      ],
    ])
    expect(view.products[0]?.image?.src).toBe("/media/p1.jpg")
    expect(view).toMatchObject({
      q: "çaki",
      total: 42,
      allPath: "/arama?q=%C3%A7aki",
      suggestions: [{ label: "çakı", path: "/arama?q=%C3%A7ak%C4%B1" }],
      // A category without a live page is left out
      categories: [{ label: "Çakılar", path: "/kategori/cakilar" }],
      brands: [{ label: "Yatağan", path: "/arama?q=%C3%A7aki&marka=yatagan" }],
    })
  })

  it("offers four categories and four brands at most, and says nothing found plainly", () => {
    const many = Array.from({ length: 6 }, (_, at) => ({
      id: `pcat_${String(at)}`,
      name: `Kategori ${String(at)}`,
    }))
    const view = suggestView({
      q: "set",
      answer: answer({
        product_ids: [],
        count: 0,
        suggestions: [],
        related: {
          categories: many,
          brands: many.map(({ id, name }) => ({ id, name, handle: id.replace("_", "-") })),
        },
      }),
      products: [],
      productPaths: {},
      displays: {},
      categoryPaths: Object.fromEntries(many.map(({ id }) => [id, `/kategori/${id}`])),
    })
    expect([view.categories.length, view.brands.length]).toEqual([4, 4])
    expect(emptySuggestion("zzqq")).toEqual({
      q: "zzqq",
      total: 0,
      allPath: "/arama?q=zzqq",
      products: [],
      categories: [],
      brands: [],
      suggestions: [],
    })
  })
})
