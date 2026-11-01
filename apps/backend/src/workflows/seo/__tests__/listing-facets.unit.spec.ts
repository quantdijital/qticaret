import type { ListingQuery } from "../../../lib/seo/facets"
import { arrange, facetsOf } from "../listing-facets"
import type { FilterDefinition, ListingRow } from "../listing-facets"

const row = (
  id: string,
  price: number | null,
  brand: string | null,
  options: Record<string, string[]>,
  created_at = 0
): ListingRow => ({
  id,
  price,
  created_at,
  brand: brand ? { handle: brand, name: brand.toUpperCase() } : null,
  options: new Map(Object.entries(options)),
})

const query = (over: Partial<ListingQuery> = {}): ListingQuery => ({
  filters: [],
  price: null,
  sort: null,
  page: 1,
  rest: [],
  ...over,
})

const rows = [
  row("a", 500, "x", { celik: ["n690"] }, 1),
  row("b", 1500, "x", { celik: ["damascus"] }, 3),
  row("c", 900, "y", { celik: ["n690", "damascus"] }, 2),
  row("d", null, null, {}, 4),
]

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
])

describe("a listing's products in memory (F18 D4)", () => {
  it("keeps the products every filter allows, in the price range, in the sort asked", () => {
    const ids = (q: ListingQuery) => arrange(rows, q).map((each) => each.id)
    expect(ids(query())).toEqual(["a", "b", "c", "d"])
    expect(ids(query({ filters: [["celik", ["damascus"]]] }))).toEqual(["b", "c"])
    expect(
      ids(
        query({
          filters: [
            ["marka", ["x"]],
            ["celik", ["n690"]],
          ],
        })
      )
    ).toEqual(["a"])
    expect(ids(query({ price: { min: 600, max: null } }))).toEqual(["b", "c"])
    expect(ids(query({ sort: "fiyat-artan" }))).toEqual(["a", "c", "b", "d"])
    expect(ids(query({ sort: "fiyat-azalan" }))).toEqual(["b", "c", "a", "d"])
    expect(ids(query({ sort: "yeni" }))).toEqual(["d", "b", "c", "a"])
  })

  it("counts a filter's values without itself, and the price range under all filters", () => {
    const facets = facetsOf(rows, query({ filters: [["celik", ["n690"]]] }), definitions)
    // Steel counted without the steel filter: two of each
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
    ])
    // Brands under the steel filter: a (x) and c (y)
    expect(facets.brands).toEqual([
      { value: "x", label: "X", count: 1, selected: false },
      { value: "y", label: "Y", count: 1, selected: false },
    ])
    expect(facets.price).toEqual({ min: 500, max: 900 })
  })

  it("has no price range when nothing is priced, and keeps a chosen value nothing has", () => {
    const facets = facetsOf(rows.slice(3), query({ filters: [["celik", ["n690"]]] }), definitions)
    expect(facets.price).toBeNull()
    expect(facets.attributes[0]?.values).toEqual([
      { value: "n690", label: "N690", count: 0, selected: true },
    ])
  })
})
