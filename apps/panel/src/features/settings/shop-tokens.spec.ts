import { describe, expect, it } from "vitest"
import { fillShopText, hasShopToken, insertToken, unknownShopTokens } from "./shop-tokens"

const VALUES = {
  telefon: "0212 123 45 67",
  ücretsiz_kargo_eşiği: "₺1.500",
  adres: null,
}

describe("shop tokens", () => {
  it("fills a known detail, leaves nothing for one not given and an unknown one as typed", () => {
    expect(fillShopText("{ücretsiz_kargo_eşiği} ve üzeri kargo bedava", VALUES)).toBe(
      "₺1.500 ve üzeri kargo bedava"
    )
    expect(fillShopText("Adres: {adres}", VALUES)).toBe("Adres: ")
    expect(fillShopText("Bizi arayın {telefon} {kargo}", VALUES)).toBe(
      "Bizi arayın 0212 123 45 67 {kargo}"
    )
    // A value never brings invisible characters to the page
    expect(fillShopText("{telefon}", { telefon: "0212\u0000 123​" })).toBe("0212 123")
  })

  it("tells a text with a detail from one without, and names the unknown ones once", () => {
    expect(hasShopToken("1500 TL ve üzeri")).toBe(false)
    expect(hasShopToken("{ kargo }")).toBe(false)
    expect(hasShopToken("{telefon}")).toBe(true)
    expect(unknownShopTokens("{telefon} {kargo} {kargo} {iade_süresi}")).toEqual([
      "kargo",
      "iade_süresi",
    ])
    // Written decomposed (a pasted ü), it is still the detail the server knows
    expect(unknownShopTokens("{ücretsiz_kargo_eşiği}")).toEqual([])
  })

  it("puts a detail in place of the selection and the caret after it", () => {
    expect(insertToken("Bizi arayın", "telefon", 4)).toEqual({
      text: "Bizi{telefon} arayın",
      caret: 13,
    })
    expect(insertToken("1500 TL ve üzeri", "ücretsiz_kargo_eşiği", 0, 7)).toEqual({
      text: "{ücretsiz_kargo_eşiği} ve üzeri",
      caret: 22,
    })
    // A caret past the end (the text changed since) lands at the end
    expect(insertToken("Ara", "telefon", 10).text).toBe("Ara{telefon}")
  })
})
