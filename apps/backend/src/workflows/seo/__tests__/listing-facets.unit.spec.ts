import type { ListingQuery } from "../../../lib/seo/facets"
import type { ListingResult } from "../../../modules/search-index/types"
import { facetsOf } from "../listing-facets"
import type { FilterDefinition } from "../listing-facets"
import { planFilters, planSort, priceKey } from "../listing-plan"

const query = (over: Partial<ListingQuery> = {}): ListingQuery => ({
  filters: [],
  price: null,
  sort: null,
  page: 1,
  rest: [],
  ...over,
})

const result = (over: Partial<ListingResult> = {}): ListingResult => ({
  count: 0,
  ids: [],
  brands: [],
  options: [],
  ownOptions: {},
  inStock: 0,
  price: null,
  related: null,
  ...over,
})

const definitions = new Map<string, FilterDefinition>([
  [
    "celik",
    {
      label: "Çelik",
      options: new Map([
        ["n690", "N690"],
        ["damascus", "Şam çeliği"],
      ]),
    },
  ],
  ["renk", { label: "Renk", options: new Map([["mavi", "Mavi"]]) }],
])

describe("a listing's facets from the index's counts (F18 D4, adr/0056)", () => {
  it("names each count, a filtered key's from its own counts, the most first", () => {
    const facets = facetsOf(
      result({
        brands: [
          { handle: "y", name: "Y", count: 1 },
          { handle: "x", name: "X", count: 3 },
        ],
        // Under every filter: the steel filter leaves one blue product
        options: [
          { value: "celik=n690", count: 2 },
          { value: "renk=mavi", count: 1 },
        ],
        // Steel counted without the steel filter
        ownOptions: {
          celik: [
            { value: "celik=n690", count: 2 },
            { value: "celik=damascus", count: 2 },
          ],
        },
        inStock: 2,
        price: { min: 499.5, max: 900.2 },
      }),
      query({ filters: [["celik", ["n690"]]] }),
      definitions
    )
    expect(facets.brands).toEqual([
      { value: "x", label: "X", count: 3, selected: false },
      { value: "y", label: "Y", count: 1, selected: false },
    ])
    expect(facets.attributes).toEqual([
      {
        key: "celik",
        label: "Çelik",
        values: [
          // Equal counts go by label
          { value: "n690", label: "N690", count: 2, selected: true },
          { value: "damascus", label: "Şam çeliği", count: 2, selected: false },
        ],
      },
      {
        key: "renk",
        label: "Renk",
        values: [{ value: "mavi", label: "Mavi", count: 1, selected: false }],
      },
    ])
    expect(facets.price).toEqual({ min: 499, max: 901 })
    expect(facets.stock).toEqual({ count: 2, selected: false })
  })

  it("has no price range when nothing is priced, and keeps a chosen value nothing has", () => {
    const facets = facetsOf(
      result({ ownOptions: { celik: [] } }),
      query({
        filters: [
          ["celik", ["n690"]],
          ["stok", ["var"]],
        ],
      }),
      definitions
    )
    expect(facets.price).toBeNull()
    expect(facets.attributes).toEqual([
      {
        key: "celik",
        label: "Çelik",
        values: [{ value: "n690", label: "N690", count: 0, selected: true }],
      },
    ])
    expect(facets.stock.selected).toBe(true)
  })
})

describe("a listing's plan (adr/0056)", () => {
  it("reads brands, attribute options and `stok` apart", () => {
    expect(
      planFilters([
        ["marka", ["atolye"]],
        ["renk", ["kirmizi", "mavi"]],
        ["stok", ["var"]],
      ])
    ).toEqual({
      brands: ["atolye"],
      options: [{ key: "renk", values: ["kirmizi", "mavi"] }],
      in_stock: true,
    })
    expect(planFilters([])).toEqual({ brands: null, options: [], in_stock: false })
  })

  it("sorts a search by relevance and a listing by age unless a sort is chosen", () => {
    expect(planSort(null, true)).toBe("relevance")
    expect(planSort(null, false)).toBe("newest")
    expect(planSort("fiyat-artan", true)).toBe("price_asc")
    expect(planSort("fiyat-azalan", false)).toBe("price_desc")
    expect(planSort("yeni", true)).toBe("newest")
    expect(priceKey("reg_1", "try")).toBe("reg_1:try")
  })
})
