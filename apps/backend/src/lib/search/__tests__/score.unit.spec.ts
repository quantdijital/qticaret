import { buildSearchIndex } from "../search-index"
import type { SearchDoc } from "../search-index"
import { MATCH, matchQuality, searchIndex } from "../score"
import { trigrams } from "../normalize"

const doc = (id: string, title: string, rest: Partial<SearchDoc> = {}): SearchDoc => ({
  id,
  title,
  ...rest,
})

const ids = (docs: SearchDoc[], query: string) =>
  searchIndex(buildSearchIndex(docs), query).map((hit) => hit.id)

const quality = (query: string, word: string) =>
  matchQuality(query, new Set(trigrams(query)), word, trigrams(word))

describe("search scoring", () => {
  it("ranks an exact word over a prefix, a stem and a typo", () => {
    expect(quality("bicak", "bicak")).toBe(MATCH.exact)
    expect(quality("bic", "bicak")).toBe(MATCH.prefix)
    expect(quality("bicaklar", "bicak")).toBe(MATCH.stem)
    const typo = quality("bicap", "bicak")
    expect(typo).toBeGreaterThan(0)
    expect(typo).toBeLessThan(MATCH.stem)
    // Too short to read as a typo, and too unlike
    expect(quality("ku", "kus")).toBe(MATCH.prefix)
    expect(quality("kupa", "kus")).toBe(0)
    expect(quality("bicak", "caki")).toBe(0)
  })

  it("orders products exact > prefix > fuzzy", () => {
    const docs = [
      doc("fuzzy", "Şef Bıçağı"),
      doc("prefix", "Bıçakçı Önlüğü"),
      doc("exact", "Ekmek Bıçak Seti"),
      doc("none", "Seramik Kupa"),
    ]
    expect(ids(docs, "bıçak")).toEqual(["exact", "prefix", "fuzzy"])
  })

  it("finds `çakı` for `cakı` and `bıçak` for `bıcak` or a typo of it", () => {
    const docs = [doc("caki", "Katlanır Çakı"), doc("bicak", "Bıçak")]
    expect(ids(docs, "cakı")).toEqual(["caki"])
    expect(ids(docs, "bıcak")).toEqual(["bicak"])
    expect(ids(docs, "bıçal")).toEqual(["bicak"])
    expect(ids(docs, "katlnır")).toEqual(["caki"])
  })

  it("weighs the title over the brand and category, those over attributes and text", () => {
    const docs = [
      doc("text", "Kılıf", { description: "<p>Bir <b>çelik</b> kılıf</p>" }),
      doc("attribute", "Kılıf", { attributes: ["paslanmaz_celik"] }),
      doc("brand", "Kılıf", { brand: { id: "b1", name: "Çelik Usta", handle: "celik-usta" } }),
      doc("title", "Çelik Kılıf"),
    ]
    expect(ids(docs, "çelik")).toEqual(["title", "brand", "attribute", "text"])
  })

  it("needs every word of a short query, all but one of a longer one", () => {
    const docs = [doc("both", "Kırmızı Çakı"), doc("one", "Mavi Çakı")]
    expect(ids(docs, "kırmızı çakı")).toEqual(["both"])
    // Three words: one may be missing, finding all ranks first
    expect(ids(docs, "kırmızı çakı mavi")).toEqual(["both", "one"])
  })

  it("lifts a title holding the whole query", () => {
    const docs = [doc("apart", "Çelik Saplı Bıçak"), doc("phrase", "Bıçak Çelik")]
    const [first] = searchIndex(buildSearchIndex(docs), "bıçak çelik")
    expect(first?.id).toBe("phrase")
  })

  it("names the product words it found as they read", () => {
    const [hit] = searchIndex(buildSearchIndex([doc("a", "Şef Bıçağı")]), "sef bicak")
    expect(hit?.matched).toEqual(expect.arrayContaining(["şef", "bıçağı"]))
  })

  it("finds nothing for an empty or punctuation-only query, and reads a long one in part", () => {
    const docs = [doc("a", "Bıçak")]
    expect(ids(docs, "")).toEqual([])
    expect(ids(docs, "  ?!  ")).toEqual([])
    expect(ids(docs, `bıçak ${"x".repeat(500)}`)).toEqual([])
    expect(ids(docs, `bıçak ${"y ".repeat(200)}`)).toEqual([])
  })

  it("reads a code or a size as written: no typo of it, no stem", () => {
    expect(quality("model12", "model123")).toBe(MATCH.prefix)
    expect(quality("model124", "model123")).toBe(0)
    expect(quality("model1234", "model123")).toBe(0)
    const docs = [doc("a", "Bıçak Model123"), doc("b", "Bıçak Model124")]
    expect(ids(docs, "model123")).toEqual(["a"])
  })

  it("keeps the catalogue's order among equals", () => {
    const docs = [doc("newer", "Çakı"), doc("older", "Çakı")]
    expect(ids(docs, "çakı")).toEqual(["newer", "older"])
  })
})
