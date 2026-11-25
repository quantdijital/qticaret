import { describe, expect, it } from "vitest"
import {
  FOCUS_KEYWORDS_MAX,
  FOCUS_KEYWORD_LENGTH,
  addFocusKeywords,
  focusKeywordsShort,
  formatFocusKeywords,
  makePrimary,
  parseFocusKeywords,
  withSuggested,
} from "./focus-keywords"

// The same reading as the server's (lib/seo/__tests__/focus-keywords.unit.spec.ts)
describe("focus keywords", () => {
  it("reads a value from before the list as one keyword, and nothing as none", () => {
    expect(parseFocusKeywords("keten gömlek")).toEqual(["keten gömlek"])
    expect(parseFocusKeywords(null)).toEqual([])
    expect(parseFocusKeywords(" , ,")).toEqual([])
  })

  it("splits a pasted list, trims it and drops Turkish-folded repeats", () => {
    expect(parseFocusKeywords(" çelik  termos ,IŞIK, ışık,, kamp termosu")).toEqual([
      "çelik termos",
      "IŞIK",
      "kamp termosu",
    ])
  })

  it("writes the list primary first, joined by a comma and a space", () => {
    expect(formatFocusKeywords(["kupa", "seramik kupa"])).toBe("kupa, seramik kupa")
    expect(formatFocusKeywords([])).toBe("")
  })

  it("stops at five keywords and says so", () => {
    const four = ["a", "b", "c", "d"]
    const added = addFocusKeywords(four, "e, f, A")
    expect(added.keywords).toEqual(["a", "b", "c", "d", "e"])
    expect(added.keywords).toHaveLength(FOCUS_KEYWORDS_MAX)
    expect(added.note).toBe("limit")
    // A repeat alone is no note
    expect(addFocusKeywords(four, "B").note).toBeNull()
  })

  it("cuts a long keyword and says so", () => {
    const added = addFocusKeywords([], "x".repeat(FOCUS_KEYWORD_LENGTH + 5))
    expect(added.keywords[0]).toHaveLength(FOCUS_KEYWORD_LENGTH)
    expect(added.note).toBe("length")
  })

  it("makes another keyword the primary, the rest in their order", () => {
    expect(makePrimary(["a", "b", "c"], 2)).toEqual(["c", "a", "b"])
    expect(makePrimary(["a", "b"], 0)).toEqual(["a", "b"])
    expect(makePrimary(["a"], 5)).toEqual(["a"])
  })

  it("adds a suggestion as the primary when empty, else after the others", () => {
    expect(withSuggested([], "çelik termos")).toEqual(["çelik termos"])
    expect(withSuggested(["termos"], "çelik termos")).toEqual(["termos", "çelik termos"])
    expect(withSuggested(["termos"], "Termos")).toEqual(["termos"])
  })

  it("says the list in a few words", () => {
    expect(focusKeywordsShort([])).toBe("")
    expect(focusKeywordsShort(["termos"])).toBe("termos")
    expect(focusKeywordsShort(["termos", "a", "b"])).toBe("termos +2")
  })
})
