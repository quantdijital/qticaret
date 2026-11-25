import {
  FOCUS_KEYWORDS_MAX,
  FOCUS_KEYWORD_LENGTH,
  SEO_META_LIMITS,
  formatFocusKeywords,
  normalizeFocusKeywords,
  parseFocusKeywords,
  primaryFocusKeyword,
} from ".."

describe("focus keywords", () => {
  it("reads a value from before the list as one keyword", () => {
    expect(parseFocusKeywords("keten gömlek")).toEqual(["keten gömlek"])
    expect(primaryFocusKeyword("keten gömlek")).toBe("keten gömlek")
  })

  it("reads nothing from an empty value", () => {
    expect(parseFocusKeywords(null)).toEqual([])
    expect(parseFocusKeywords(undefined)).toEqual([])
    expect(parseFocusKeywords("  ,  , ")).toEqual([])
    expect(primaryFocusKeyword("")).toBeNull()
    expect(formatFocusKeywords([])).toBeNull()
  })

  it("splits at commas, trims, collapses spaces and keeps the order", () => {
    expect(parseFocusKeywords(" çelik  termos ,termos 750 ml,, kamp termosu ")).toEqual([
      "çelik termos",
      "termos 750 ml",
      "kamp termosu",
    ])
  })

  it("drops repeats under Turkish case folding", () => {
    expect(parseFocusKeywords("IŞIK, ışık, Işık lamba, İğne, iğne")).toEqual([
      "IŞIK",
      "Işık lamba",
      "İğne",
    ])
  })

  it("keeps at most five keywords of sixty characters", () => {
    const long = "a".repeat(FOCUS_KEYWORD_LENGTH + 20)
    const list = parseFocusKeywords(`${long}, b, c, d, e, f, g`)
    expect(list).toHaveLength(FOCUS_KEYWORDS_MAX)
    expect(list[0]).toHaveLength(FOCUS_KEYWORD_LENGTH)
    // The longest list still fits the column's cap
    const longest = formatFocusKeywords(
      Array.from({ length: FOCUS_KEYWORDS_MAX }, (_, at) => `${String(at)}${long}`)
    )
    expect(longest?.length).toBeLessThanOrEqual(SEO_META_LIMITS.focus_keyword)
  })

  it("writes the list primary first, joined by a comma and a space", () => {
    expect(formatFocusKeywords(["kupa", " seramik kupa ", "KUPA"])).toBe("kupa, seramik kupa")
    expect(normalizeFocusKeywords("kupa,seramik kupa")).toBe("kupa, seramik kupa")
    expect(normalizeFocusKeywords(" ")).toBeNull()
  })
})
