import type { ListingRow } from "../listing-facets"
import { searchDocOf, searchListingRows } from "../listing-search"

const row = (id: string, title: string, extra: Partial<ListingRow> = {}): ListingRow => ({
  id,
  created_at: 0,
  brand: null,
  options: new Map(),
  price: null,
  doc: { id, title },
  ...extra,
})

describe("listing search", () => {
  it("reads shown categories and public attributes only", () => {
    const doc = searchDocOf({
      id: "p1",
      title: "Şef Bıçağı",
      brand: { id: "brand_1", handle: "usta", name: "Usta" },
      categories: [
        { id: "c1", name: "Mutfak", is_active: true, is_internal: false },
        { id: "c2", name: "Taslak", is_active: false, is_internal: false },
        { id: "c3", name: "İç", is_active: true, is_internal: true },
        null,
      ],
      attribute_values: [
        { value_text: "paslanmaz_celik", definition: { is_public: true } },
        { value_options: ["kirmizi", "mavi"], definition: { is_public: true } },
        { value_text: "tedarikci-kodu", definition: { is_public: false } },
        { value_text: "sahipsiz", definition: null },
      ],
    })
    expect(doc).toMatchObject({
      id: "p1",
      title: "Şef Bıçağı",
      brand: { id: "brand_1", handle: "usta", name: "Usta" },
      categories: [{ id: "c1", name: "Mutfak" }],
      attributes: ["paslanmaz_celik", "kirmizi", "mavi"],
    })
    // A brand read without its id (no search fields) is none
    expect(searchDocOf({ id: "p2", brand: { handle: "x", name: "X" } }).brand).toBeNull()
  })

  it("answers rows by relevance, the query kept with its rows load", async () => {
    const rows = [row("a", "Şef Bıçağı"), row("b", "Ekmek Bıçak Seti"), row("c", "Kupa")]
    const first = await searchListingRows(rows, "bicak")
    expect(first.rows.map((each) => each.id)).toEqual(["b", "a"])
    expect(first.suggestions).toEqual([])
    // The same rows answer the same query from what is kept
    const again = await searchListingRows(rows, "bicak")
    expect(again.rows[0]).toBe(rows[1])
    expect((await searchListingRows(rows, "bical")).suggestions[0]).toBe("bıçak")
    // A row without a search doc (not the whole catalogue's) is never found
    const plain: ListingRow = { id: "d", created_at: 0, brand: null, options: new Map(), price: 1 }
    expect((await searchListingRows([plain], "kupa")).rows).toEqual([])
  })
})
