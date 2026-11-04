import { describe, expect, it } from "vitest"
import { addTerms, checkTerm, comparedTerm, synonymProblemOf, termWords } from "./terms"

describe("synonym terms (adr/0056), as the server keeps them", () => {
  it("reads words the Turkish way, anything not a letter or digit between them", () => {
    expect(termWords("  T-Shirt  ")).toEqual(["t", "shirt"])
    expect(termWords("İNCE IŞIK")).toEqual(["ince", "ışık"])
    expect(termWords("!!! ...")).toEqual([])
    expect(comparedTerm("Bıçağı ŞEF")).toBe("bicagi sef")
  })

  it("keeps a term of one to three words in lower case", () => {
    expect(checkTerm("Cep  Bıçağı", [])).toEqual({ ok: true, term: "cep bıçağı" })
    expect(checkTerm("a b c", [])).toEqual({ ok: true, term: "a b c" })
  })

  it("refuses a long phrase, a term without letters and an overlong word", () => {
    expect(checkTerm("a b c d", [])).toEqual({ ok: false, problem: "words" })
    expect(checkTerm("--", [])).toEqual({ ok: false, problem: "noWords" })
    expect(checkTerm("x".repeat(61), [])).toEqual({ ok: false, problem: "length" })
    expect(checkTerm("x".repeat(60), [])).toEqual({ ok: true, term: "x".repeat(60) })
  })

  it("passes over a term the group already has as search compares it, as the server does", () => {
    expect(checkTerm("TİŞÖRT", ["tişört"])).toEqual({ ok: true, term: "tişört", already: true })
    expect(checkTerm("tisort", ["tişört"])).toMatchObject({ ok: true, already: true })
    // Even in a full group: nothing is added
    const ten = Array.from({ length: 10 }, (_, index) => `terim${String(index)}`)
    expect(checkTerm("TERIM3", ten)).toMatchObject({ ok: true, already: true })
    // "t shirt" and "tshirt" are two terms to search
    expect(checkTerm("tshirt", ["t shirt"])).toEqual({ ok: true, term: "tshirt" })
  })

  it("refuses an eleventh term", () => {
    const ten = Array.from({ length: 10 }, (_, index) => `terim${String(index)}`)
    expect(checkTerm("bir tane daha", ten)).toEqual({ ok: false, problem: "full" })
  })

  it("adds terms split by commas in order, stopping at the first refused one", () => {
    expect(addTerms("çakı, Bıçak ,, ", [])).toEqual({
      group: ["çakı", "bıçak"],
      rest: "",
      problem: null,
    })
    expect(addTerms("çakı, a b c d, kama", ["bıçak"])).toEqual({
      group: ["bıçak", "çakı"],
      rest: "a b c d, kama",
      problem: "words",
    })
    expect(addTerms("", ["bıçak"])).toEqual({ group: ["bıçak"], rest: "", problem: null })
    // A repeat is passed over and the rest still taken
    expect(addTerms("ÇAKI, kama", ["çakı"])).toEqual({
      group: ["çakı", "kama"],
      rest: "",
      problem: null,
    })
  })

  it("reads the size rules' keys the server answers with", () => {
    expect(synonymProblemOf({ status: 400, message: "search.synonym_term_length" })).toBe("length")
    expect(
      synonymProblemOf({
        status: 400,
        message: "Invalid request: search.synonym_term_length; search.synonym_terms_too_few",
      })
    ).toBe("length")
  })

  it("finds the server's refusal in the key, the message or the general sentence", () => {
    expect(synonymProblemOf({ status: 400, code: "search.synonym_terms_too_few" })).toBe("tooFew")
    expect(synonymProblemOf({ status: 404, message: "search.synonym_unknown" })).toBe("unknown")
    expect(
      synonymProblemOf({
        status: 400,
        message: "İşlem tamamlanamadı (hata kodu: search.synonyms_too_many).",
      })
    ).toBe("groupsFull")
    expect(synonymProblemOf({ message: "search.synonym_term_too_long" })).toBe("words")
    expect(synonymProblemOf({ message: "search.synonym_terms_too_many" })).toBe("full")
    expect(synonymProblemOf({ message: "search.synonym_term_invalid" })).toBe("invalid")
    expect(synonymProblemOf({ status: 400, message: "catalog.handle_taken" })).toBeNull()
    expect(synonymProblemOf(null)).toBeNull()
  })
})
