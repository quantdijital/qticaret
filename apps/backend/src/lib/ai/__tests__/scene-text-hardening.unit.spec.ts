import { cleanSceneText, hidesCharacters, looksLikeLink } from "../scene-text"

/**
 * A scene the shop writes (adr/0071 Ek 2026-11-19): characters that draw
 * nothing and heaps of combining marks are refused, and an address is
 * caught in any script, on its NFKC form, with spaces around its dot,
 * while a sentence's own full stop still passes.
 */

describe("a scene's description: characters that draw nothing", () => {
  it.each([
    ["a variation selector", "masa\uFE0F üstü"],
    ["a supplementary variation selector", "masa\u{E0100} üstü"],
    ["the grapheme joiner", "ma\u034Fsa üstü"],
    ["the Hangul filler", "masa \u3164 üstü"],
    ["the Hangul choseong filler", "masa\u115F üstü"],
    ["the Hangul jungseong filler", "masa\u1160 üstü"],
    ["the half-width Hangul filler", "masa \uFFA0 üstü"],
    ["a zero-width space", "ma\u200Bsa üstü"],
    ["a soft hyphen", "ma\u00ADsa üstü"],
    ["a tag character", "masa\u{E0041} üstü"],
    ["the blank Braille pattern", "masa \u2800 üstü"],
    ["four marks on one letter", "max\u0301\u0302\u0303\u0304 üstü"],
    ["a mark with no letter before it", "masa \u0301 üstü"],
    ["a mark at the start", "\u0301masa üstü"],
  ])("refuses %s", (_what, raw) => {
    expect(hidesCharacters(raw.normalize("NFC"))).toBe(true)
    expect(cleanSceneText(raw)).toBeNull()
  })

  it("keeps Turkish and other accented letters, composed or not", () => {
    expect(cleanSceneText("yumuşak ışık, çığ gibi ağaç gölgesi")).toBe(
      "yumuşak ışık, çığ gibi ağaç gölgesi"
    )
    // Decomposed letters are composed (NFC) and pass
    expect(cleanSceneText("s\u0327eker ve c\u0327ay")).toBe("şeker ve çay")
    // Up to three marks on one letter (Vietnamese takes two)
    expect(cleanSceneText("phở và bánh mì")).toBe("phở và bánh mì")
    expect(cleanSceneText("a\u0300\u0323\u031B")).not.toBeNull()
    expect(cleanSceneText("Ağaç masa üstünde, örn. ahşap")).toBe("Ağaç masa üstünde, örn. ahşap")
  })
})

describe("a scene's description: addresses", () => {
  it.each([
    ["a non-ASCII host", "ğüş.com üstünde"],
    ["a country domain", "evil.de gibi"],
    ["a one-letter host", "x.ru"],
    ["spaces around the dot", "evil . com"],
    ["a space before the dot", "evil .com"],
    ["a well-known TLD after a sentence-like dot", "evil. com"],
    ["full-width letters and dot", "ｅｖｉｌ．ｃｏｍ"],
    ["an uppercase host", "EVIL.COM"],
    ["www", "www.example"],
    ["a scheme", "ftp://files"],
    ["an IP address", "192.168.0.1"],
    ["a dotted IP address with spaces", "10 . 0 . 0 . 1"],
  ])("refuses %s", (_what, raw) => {
    expect(looksLikeLink(raw)).toBe(true)
    expect(cleanSceneText(raw)).toBeNull()
  })

  it.each([
    ["a sentence's full stop then words", "yumuşak ışık. arka plan bulanık"],
    ["a full stop then a capital", "Mermer tezgah. Arka planda zeytin dalı"],
    ["an abbreviation", "örn. ahşap, vb. doğal malzemeler"],
    ["a decimal", "1.5 m genişlikte masa"],
    ["a full stop at the end", "beyaz stüdyo zemini."],
    ["an ellipsis", "sisli bir sabah… arka plan"],
    ["a dot then a short word", "ışık. ve gölge"],
  ])("lets through %s", (_what, raw) => {
    expect(looksLikeLink(raw)).toBe(false)
    expect(cleanSceneText(raw)).toBe(raw)
  })
})
