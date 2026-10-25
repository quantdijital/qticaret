import { describe, expect, it } from "vitest"
import { excerpt, plainText, priceSentence } from "./seo-text"

// The same cases as the server's (lib/seo/__tests__/resolve.unit.spec.ts)
describe("SEO text rules", () => {
  it("cuts at a word, without a dangling joiner", () => {
    expect(excerpt("Bir iki üç dört, beş altı", 17)).toBe("Bir iki üç dört")
    expect(excerpt("<b>Kısa</b> metin", 50)).toBe("Kısa metin")
  })

  it("drops tags and entities", () => {
    expect(plainText("<p>Bir&nbsp;iki</p>\n<p>üç</p>")).toBe("Bir iki üç")
  })

  it("says one price or where a range starts", () => {
    expect(priceSentence([899, 899])).toBe("899,00 TL.")
    expect(priceSentence([1250, 999.5, 0])).toBe("999,50 TL'den başlayan fiyatlarla.")
    expect(priceSentence([])).toBe("")
  })
})
