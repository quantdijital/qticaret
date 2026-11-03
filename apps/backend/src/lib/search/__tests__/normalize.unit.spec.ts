import {
  MAX_QUERY_WORDS,
  foldWord,
  normalizeText,
  queryTerms,
  queryWords,
  wordsOf,
} from "../normalize"

describe("search normalisation", () => {
  it.each([
    ["İSTANBUL", "istanbul"],
    ["ILIK", "ilik"],
    ["ılık", "ilik"],
    ["  ŞEF   BIÇAĞI! ", "sef bicagi"],
    ["Ğ ğ Ü ü Ö ö Ç ç", "g g u u o o c c"],
    ["Kâğıt Havlu", "kagit havlu"],
    ["3'lü set\t—\nçelik", "3 lu set celik"],
    ["ＫＵＰＡ ２", "kupa 2"],
    ["", ""],
    ["!!! ---", ""],
  ])("compares %j as %j", (text, compared) => {
    expect(normalizeText(text)).toBe(compared)
  })

  it("splits on anything not a letter, digit or mark, emoji and astral characters included", () => {
    // A mathematical bold `𝐀` is compatibility for `A`
    expect(wordsOf("kupa🔪bıçak 𝐀 x").map((word) => word.norm)).toEqual(["kupa", "bicak", "a", "x"])
    // A letter beyond the BMP is a letter
    expect(wordsOf("a𐐀b").map((word) => word.display)).toEqual(["a𐐨b"])
    expect(normalizeText("北京 ürün")).toBe("北京 urun")
  })

  it("reads `cakı` and `bıcak` as `çakı` and `bıçak`", () => {
    expect(normalizeText("cakı")).toBe(normalizeText("çakı"))
    expect(normalizeText("bıcak")).toBe(normalizeText("bıçak"))
    expect(foldWord("bıçağı")).toBe("bicagi")
  })

  it("keeps each word as typed, Turkish lower case with its marks", () => {
    expect(wordsOf("Şef BIÇAĞI")).toEqual([
      { display: "şef", norm: "sef" },
      { display: "bıçağı", norm: "bicagi" },
    ])
  })

  it("drops joining words unless nothing else is left, each word once", () => {
    expect(queryWords("bıçak ve kılıf için bıçak")).toEqual(["bicak", "kilif"])
    expect(queryWords("ve ile")).toEqual(["ve", "ile"])
    expect(queryWords("")).toEqual([])
    expect(queryWords("   ")).toEqual([])
  })

  it("reads no more than a search's words and length", () => {
    const many = Array.from({ length: 20 }, (_, n) => `kelime${String(n)}`).join(" ")
    expect(queryWords(many)).toHaveLength(MAX_QUERY_WORDS)
    expect(queryWords("a".repeat(5000))).toEqual(["a".repeat(100)])
  })

  it("keeps each query word as typed beside its compared form", () => {
    expect(queryTerms("ŞEF ve Bıçağı şef")).toEqual([
      { display: "şef", norm: "sef" },
      { display: "bıçağı", norm: "bicagi" },
    ])
  })
})
