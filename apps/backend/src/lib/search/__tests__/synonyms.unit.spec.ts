import { isValidationError } from "../../errors"
import { synonymTerms } from "../synonyms"

/** The refusal `synonymTerms` throws: its key and field. */
function refusal(terms: string[]): { key: string; field: string | undefined } | null {
  try {
    synonymTerms(terms)
    return null
  } catch (error) {
    if (!isValidationError(error)) {
      throw error
    }
    return { key: error.safeMessage, field: error.field }
  }
}

describe("a synonym group's terms (adr/0056)", () => {
  it("keeps each term once as search compares it, as typed in Turkish lower case", () => {
    expect(synonymTerms(["Tişört", "t  shirt", "TİŞÖRT", "tisort"])).toEqual(["tişört", "t shirt"])
    expect(synonymTerms(["kupa", "bardak!"])).toEqual(["kupa", "bardak"])
  })

  it.each([
    ["!!!", ["!!!", "kupa"]],
    ["a blank", ["", "kupa", "bardak"]],
    ["marks alone", ["́̈", "kupa", "bardak"]],
    ["a control character", ["ku\u0007pa", "bardak"]],
    ["a NUL", ["kupa\u0000", "bardak"]],
    ["a lone surrogate", ["kupa\ud800", "bardak"]],
  ])("refuses a term with %s, naming its place, rather than dropping it", (_, terms) => {
    expect(refusal(terms)).toEqual({ key: "search.synonym_term_invalid", field: "terms.0" })
  })

  it("refuses a term with no letter or digit even when two good ones are left", () => {
    expect(refusal(["kupa", "bardak", "???"])).toEqual({
      key: "search.synonym_term_invalid",
      field: "terms.2",
    })
  })

  it("refuses a term of more than three words, naming its place", () => {
    expect(refusal(["e", "a b c d"])).toEqual({
      key: "search.synonym_term_too_long",
      field: "terms.1",
    })
  })

  it("refuses a group of fewer than two distinct terms, or more than ten", () => {
    expect(refusal(["kupa", "KUPA"])).toEqual({
      key: "search.synonym_terms_too_few",
      field: "terms",
    })
    const eleven = Array.from({ length: 11 }, (_, index) => `terim ${String(index)}`)
    expect(refusal(eleven)).toEqual({ key: "search.synonym_terms_too_many", field: "terms" })
  })
})
