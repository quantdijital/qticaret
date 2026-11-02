import { buildSearchIndex } from "../search-index"
import type { SearchDoc } from "../search-index"
import { MATCH, candidateWords, matchQuality, searchIndex, wordQualities } from "../score"
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

  it("reads a description's opening only, its tags left out, a tag the cut opened too", () => {
    const docs = [
      doc("short", "Kılıf", { description: "<p>Deri <b>kılıf</b> &amp; kayış</p>" }),
      doc("long", "Kılıf", {
        description: `${"a ".repeat(198)}<span class="renk">${"b".repeat(50)}`,
      }),
    ]
    const index = buildSearchIndex(docs)
    expect(index.words).toEqual(expect.arrayContaining(["deri", "kayis"]))
    expect(index.words).not.toEqual(expect.arrayContaining(["p", "amp", "spa", "class"]))
  })
})

// A made-up vocabulary, the same each run (no Math.random: a failure must repeat)
function seeded(seed: number) {
  let state = seed
  return () => {
    state = (state * 1_103_515_245 + 12_345) % 2_147_483_648
    return state / 2_147_483_648
  }
}

function catalogue(size: number) {
  const random = seeded(7)
  const letters = "abcçdefgğhıijklmnoöprsştuüvyz"
  const word = (length: number) =>
    Array.from({ length }, () => letters[Math.floor(random() * letters.length)]).join("")
  return Array.from({ length: size }, (_, at) =>
    doc(
      `p${String(at)}`,
      `${word(3 + Math.floor(random() * 8))} ${word(4 + Math.floor(random() * 6))}`,
      {
        description: `${word(5)} ${word(9)} model${String(at % 50)}`,
      }
    )
  )
}

describe("search candidates (adr/0046 ek 2026-11-03)", () => {
  const index = buildSearchIndex([
    ...catalogue(2000),
    doc("k1", "Katlanır Çakı"),
    doc("k2", "Şef Bıçağı Bıçaklar"),
    doc("k3", "Bıçak Model123"),
  ])

  it("weighs a query word as comparing it with the whole vocabulary would", () => {
    const random = seeded(11)
    const queries = ["a", "bi", "bic", "bicak", "bicaklar", "bical", "katlnır", "sef", "model12"]
    for (let at = 0; at < 100; at += 1) {
      const word = index.words[Math.floor(random() * index.words.length)] ?? ""
      const cut = Math.max(1, Math.floor(random() * word.length))
      // The word, its start, the word with a suffix, and a typo of it
      queries.push(
        word,
        word.slice(0, cut),
        `${word}ler`,
        `${word.slice(0, cut)}x${word.slice(cut + 1)}`
      )
    }
    let differ = 0
    let matched = 0
    for (const query of queries) {
      const grams = new Set(trigrams(query))
      const qualities = wordQualities(index, query)
      index.words.forEach((word, id) => {
        const quality = matchQuality(query, grams, word, index.grams[id] ?? [])
        differ += quality === qualities[id] ? 0 : 1
        matched += quality > 0 ? 1 : 0
      })
    }
    expect(differ).toBe(0)
    expect(matched).toBeGreaterThan(queries.length)
  })

  it("meets few words and ends at once for a pasted string of random letters", () => {
    const random = seeded(3)
    const pasted = Array.from({ length: 100 }, () =>
      String.fromCharCode(97 + Math.floor(random() * 26))
    ).join("")

    const started = performance.now()
    const hits = searchIndex(index, pasted)
    const took = performance.now() - started

    expect(candidateWords(index, pasted).length).toBeLessThanOrEqual(10)
    expect(hits).toEqual([])
    expect(took).toBeLessThan(100)
  })
})
