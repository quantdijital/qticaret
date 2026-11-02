import type { ContentDoc } from "../../content"
import { fillShopDoc, fillShopText, unknownDocTokens, unknownShopTokens } from "../tokens"
import type { ShopInfoValues } from "../tokens"

const values: ShopInfoValues = {
  mağaza_adı: "My L'arte",
  telefon: "0534 255 11 45",
  e_posta: "info@ornek.com",
  adres: "Bağbaşı, Pamukkale / Denizli",
  whatsapp: null,
  ücretsiz_kargo_eşiği: "₺1.500",
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
