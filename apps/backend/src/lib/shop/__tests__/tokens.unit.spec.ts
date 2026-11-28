import type { ContentDoc } from "../../content"
import {
  fillShopDoc,
  fillShopText,
  fillShopTextWhole,
  unknownDocTokens,
  unknownShopTokens,
} from "../tokens"
import type { ShopInfoValues } from "../tokens"

const values: ShopInfoValues = {
  mağaza_adı: "My L'arte",
  telefon: "0534 255 11 45",
  e_posta: "info@ornek.com",
  adres: "Bağbaşı, Pamukkale / Denizli",
  whatsapp: null,
  ücretsiz_kargo_eşiği: "₺1.500",
  hazırlama_süresi: "1–2 iş günü",
  kargo_süresi: "1–3 iş günü",
  iade_süresi: "14",
}

describe("shop info tokens", () => {
  it("fills the shop's details and leaves other braces alone", () => {
    expect(fillShopText("{ücretsiz_kargo_eşiği} ve üzeri kargo bedava", values)).toBe(
      "₺1.500 ve üzeri kargo bedava"
    )
    expect(fillShopText("Bize {telefon} numarasından ulaşın.", values)).toBe(
      "Bize 0534 255 11 45 numarasından ulaşın."
    )
    // A detail not given leaves nothing; an unknown name is not touched
    expect(fillShopText("[{whatsapp}] {indirim}", values)).toBe("[] {indirim}")
  })

  it("fills the shipping days and the withdrawal period a starter page cites", () => {
    expect(
      fillShopText(
        "{hazırlama_süresi} içinde kargoda, {kargo_süresi} içinde kapıda; {iade_süresi} gün iade.",
        values
      )
    ).toBe("1–2 iş günü içinde kargoda, 1–3 iş günü içinde kapıda; 14 gün iade.")
    expect(unknownShopTokens("{hazırlama_süresi} {kargo_süresi} {iade_süresi}")).toEqual([])
  })

  it("fills a line only whole: none when a detail it names is not given", () => {
    expect(fillShopTextWhole("{ücretsiz_kargo_eşiği} üzeri kargo bedava", values)).toBe(
      "₺1.500 üzeri kargo bedava"
    )
    expect(fillShopTextWhole("{whatsapp} ile yazın", values)).toBeNull()
    expect(
      fillShopTextWhole("{ücretsiz_kargo_eşiği} üzeri", { ...values, ücretsiz_kargo_eşiği: "​" })
    ).toBeNull()
    // No token, or a name that is no shop detail: the line as it is
    expect(fillShopTextWhole("Yeni sezon {indirim}", values)).toBe("Yeni sezon {indirim}")
  })

  it("names the tokens that are no shop detail", () => {
    expect(unknownShopTokens("{telefon} {telfon} {e_posta} { boşluklu }")).toEqual(["telfon"])
    expect(unknownShopTokens('JSON: {"a": 1}')).toEqual([])
  })

  it("fills a document's text at every depth and finds its unknown tokens", () => {
    const doc: ContentDoc = {
      type: "doc",
      content: [
        { type: "heading", attrs: { level: 2 }, content: [{ type: "text", text: "{mağaza_adı}" }] },
        {
          type: "bulletList",
          content: [
            {
              type: "listItem",
              content: [
                {
                  type: "paragraph",
                  content: [
                    { type: "text", text: "E-posta: {e_posta}" },
                    { type: "hardBreak" },
                    { type: "text", text: "{kupon}" },
                  ],
                },
              ],
            },
          ],
        },
      ],
    }

    const filled = JSON.stringify(fillShopDoc(doc, values))
    expect(filled).toContain("My L'arte")
    expect(filled).toContain("E-posta: info@ornek.com")
    expect(filled).toContain("{kupon}")
    expect(unknownDocTokens(doc)).toEqual(["kupon"])
  })
})
