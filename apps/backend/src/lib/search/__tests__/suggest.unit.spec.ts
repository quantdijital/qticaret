import { buildSearchIndex } from "../search-index"
import type { SearchDoc } from "../search-index"
import { searchIndex } from "../score"
import { MAX_SUGGESTIONS, relatedTerms, suggest } from "../suggest"

const kitchen = { id: "pcat_mutfak", name: "Mutfak" }
const outdoor = { id: "pcat_kamp", name: "Kamp" }
const usta = { id: "brand_usta", name: "Usta", handle: "usta" }

const docs: SearchDoc[] = [
  { id: "p1", title: "Ekmek Bıçak Seti", categories: [kitchen], brand: usta },
  { id: "p2", title: "Şef Bıçağı", categories: [kitchen], brand: usta },
  { id: "p3", title: "Katlanır Çakı", categories: [outdoor] },
  { id: "p4", title: "Kamp Bıçak Kılıfı", categories: [outdoor, kitchen] },
  { id: "p5", title: "Seramik Kupa" },
]
const index = buildSearchIndex(docs)

describe("search suggestions", () => {
  it("offers the title word a one-letter typo meant", () => {
    expect(suggest("bıçal", index)[0]).toBe("bıçak")
    expect(suggest("katlnır", index)).toEqual(["katlanır"])
  })

  it("keeps a known word, as the catalogue writes it, and mends the other", () => {
    expect(suggest("ekmek bıçal", index)[0]).toBe("ekmek bıçak")
    // The query as compared (no marks) still reads as the titles do; no
    // product holds `şef` and `bıçak`, one holds `şef` and `bıçağı`
    expect(suggest("sef bical", index)).toEqual(["şef bıçağı"])
  })

  it("offers nothing when every word is the catalogue's own, nor for nothing alike", () => {
    expect(suggest("bıçak", index)).toEqual([])
    expect(suggest("bıc", index)).toEqual([])
    expect(suggest("bıçaklar", index)).toEqual([])
    expect(suggest("zzzz", index)).toEqual([])
    expect(suggest("", index)).toEqual([])
  })

  it("offers only phrases some product holds, five at most", () => {
    // `seramik` and `bıçak` share no product: no phrase of both
    expect(suggest("seramik bıçal", index)).toEqual([])
    const many = buildSearchIndex(
      Array.from({ length: 12 }, (_, n) => ({
        id: `m${String(n)}`,
        title: `kalem${"x".repeat(n)}`,
      }))
    )
    expect(suggest("kalam", many).length).toBeLessThanOrEqual(MAX_SUGGESTIONS)
  })
})

describe("related terms", () => {
  it("names the categories and brands most hits are in, the most common first", () => {
    const hits = searchIndex(index, "bıçak")
    expect(relatedTerms(hits, index)).toEqual({
      categories: [kitchen, outdoor],
      brands: [usta],
    })
    expect(relatedTerms([], index)).toEqual({ categories: [], brands: [] })
  })
})
