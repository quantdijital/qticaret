import { readQuery, synonymMap } from "../query"
import { allOf, anyOf, enoughOf, followedBy, lexeme, stemLexeme } from "../tsquery"

describe("tsquery values (adr/0056)", () => {
  it("quotes every lexeme, so no word is read as an operator", () => {
    expect(lexeme("bicak")).toBe("'bicak'")
    expect(lexeme("bic", true)).toBe("'bic':*")
    expect(lexeme("a'b\\c")).toBe("'a''b\\\\c'")
    expect(lexeme("&|!")).toBe("'&|!'")
    expect(stemLexeme("bicak")).toBe("'~bicak'")
    expect(followedBy(["t", "shirt"])).toBe("('t' <-> 'shirt')")
    expect(followedBy(["tek"])).toBe("'tek'")
  })

  it("joins parts, each once, an empty one left out", () => {
    expect(anyOf(["'a'", "'b'", "'a'", ""])).toBe("('a' | 'b')")
    expect(anyOf(["'a'"])).toBe("'a'")
    expect(anyOf([])).toBe("")
    expect(allOf(["'a'", "'b'"])).toBe("('a' & 'b')")
  })

  it("needs every unit of one or two, all but one of more", () => {
    expect(enoughOf(["'a'"])).toBe("'a'")
    expect(enoughOf(["'a'", "'b'"])).toBe("('a' & 'b')")
    expect(enoughOf(["'a'", "'b'", "'c'"])).toBe("(('b' & 'c') | ('a' & 'c') | ('a' & 'b'))")
  })
})

describe("a query read into units (adr/0056)", () => {
  it("keeps each word as typed and compared, the last one open to its endings", () => {
    const read = readQuery("Şef BIÇAĞI ve kılıf")
    expect(read.words.map((word) => word.norm)).toEqual(["sef", "bicagi", "kilif"])
    expect(read.units.map((unit) => [unit.words[0]?.display, unit.last])).toEqual([
      ["şef", false],
      ["bıçağı", false],
      ["kılıf", true],
    ])
    // The phrase keeps joining words: a title equal to the query is lifted
    expect(read.phrase).toBe("sef bicagi ve kilif")
  })

  it("reads nothing from punctuation, and no more than eight words", () => {
    expect(readQuery("?! --").units).toEqual([])
    const many = Array.from({ length: 20 }, (_, n) => `kelime${String(n)}`).join(" ")
    expect(readQuery(many).units).toHaveLength(8)
  })

  it("finds the shop's synonyms, the longest term at each place, both ways", () => {
    const synonyms = synonymMap([
      ["tişört", "T Shirt", "tshirt"],
      ["çakı", "katlanır bıçak"],
      ["tek"],
      ["a b c d", "uzun"],
    ])
    expect(synonyms.get("tisort")).toEqual([["t", "shirt"], ["tshirt"]])
    expect(synonyms.get("t shirt")).toEqual([["tisort"], ["tshirt"]])
    // A group of one term has no other; a term of four words is no term
    expect(synonyms.get("tek")).toEqual([])
    expect(synonyms.has("a b c d")).toBe(false)

    const read = readQuery("mavi katlanır bıçak", synonyms)
    expect(read.units.map((unit) => unit.words.map((word) => word.norm))).toEqual([
      ["mavi"],
      ["katlanir", "bicak"],
    ])
    expect(read.units[1]?.synonyms).toEqual([["caki"]])
    // A unit of two words is not matched as a word's start
    expect(read.units[1]?.last).toBe(false)
  })
})
