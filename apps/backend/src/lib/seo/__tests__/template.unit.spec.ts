import { ValidationError } from "../../errors"
import {
  assertValidTemplate,
  checkTemplate,
  renderTemplate,
  withoutRepeatedParts,
} from "../template"

const PRODUCT_TOKENS = ["ürün_adı", "marka", "mağaza", "öne_çıkan_attribute"]

describe("checkTemplate", () => {
  it("accepts a template with known tokens", () => {
    expect(checkTemplate("{ürün_adı} | {marka} | {mağaza}", PRODUCT_TOKENS)).toEqual({
      unknownTokens: [],
      isMalformed: false,
    })
  })

  it("lists unknown tokens once each", () => {
    expect(checkTemplate("{ürün_adi} {fiyat} {fiyat}", PRODUCT_TOKENS).unknownTokens).toEqual([
      "ürün_adi",
      "fiyat",
    ])
  })

  it.each([
    ["an unclosed brace", "{ürün_adı | {marka}"],
    ["a stray closing brace", "{marka} }"],
    ["an empty token", "{} | {marka}"],
    ["a token with spaces", "{ürün adı}"],
  ])("flags %s as malformed", (_label, template) => {
    expect(checkTemplate(template, PRODUCT_TOKENS).isMalformed).toBe(true)
  })
})

describe("assertValidTemplate", () => {
  it("throws a ValidationError with an i18n key for an unknown token", () => {
    expect(() => {
      assertValidTemplate("{ürün_adı} | {fiyat}", PRODUCT_TOKENS)
    }).toThrow(ValidationError)

    let thrown: unknown
    try {
      assertValidTemplate("{fiyat}", PRODUCT_TOKENS, "title_template")
    } catch (error) {
      thrown = error
    }
    expect(thrown).toMatchObject({ safeMessage: "seo.template_invalid", field: "title_template" })
  })

  it("accepts a template whose tokens arrive decomposed (NFD)", () => {
    expect(() => {
      assertValidTemplate("{ürün_adı}".normalize("NFD"), PRODUCT_TOKENS)
    }).not.toThrow()
  })

  it("passes a valid template", () => {
    expect(() => {
      assertValidTemplate("{ürün_adı} - {öne_çıkan_attribute} | {marka}", PRODUCT_TOKENS)
    }).not.toThrow()
  })
})

describe("renderTemplate", () => {
  const values = {
    ürün_adı: "Şef Bıçağı",
    marka: "Örnek",
    mağaza: "Mağazam",
    öne_çıkan_attribute: "20 cm",
  }

  it("fills every token", () => {
    expect(renderTemplate("{ürün_adı} - {öne_çıkan_attribute} | {marka}", values)).toBe(
      "Şef Bıçağı - 20 cm | Örnek"
    )
  })

  it.each([
    ["a middle token", "{ürün_adı} | {marka} | {mağaza}", { marka: "" }, "Şef Bıçağı | Mağazam"],
    ["the first token", "{marka} | {ürün_adı}", { marka: undefined }, "Şef Bıçağı"],
    ["the last token", "{ürün_adı} | {mağaza}", { mağaza: null }, "Şef Bıçağı"],
    [
      "mixed separators",
      "{ürün_adı} - {öne_çıkan_attribute} | {marka}",
      { öne_çıkan_attribute: " " },
      // The stronger joiner stays: the brand is not read as an attribute
      "Şef Bıçağı | Örnek",
    ],
    [
      "text after an empty token",
      "{kategori} Modelleri ve Fiyatları | {mağaza}",
      { mağaza: "" },
      "Modelleri ve Fiyatları",
    ],
  ])("drops %s with its separator", (_label, template, overrides, expected) => {
    expect(renderTemplate(template, { ...values, ...overrides })).toBe(expected)
  })

  it("keeps a closing full stop but not the space an empty token leaves", () => {
    const template = "{kısa_açıklama}. {fiyat_cümlesi} {kargo_cümlesi}"

    expect(renderTemplate(template, { kısa_açıklama: "Paslanmaz çelik", fiyat_cümlesi: "" })).toBe(
      "Paslanmaz çelik."
    )
    expect(renderTemplate(template, { fiyat_cümlesi: "1.250 TL'den başlayan fiyatlarla" })).toBe(
      "1.250 TL'den başlayan fiyatlarla"
    )
  })

  it("keeps hyphens inside words and numbers", () => {
    expect(
      renderTemplate("{ürün_adı} | {marka}", { ürün_adı: "Wi-Fi 2020-2025", marka: "X" })
    ).toBe("Wi-Fi 2020-2025 | X")
  })

  it.each([
    [
      "a description that already ends a sentence",
      "{kısa_açıklama}. {fiyat_cümlesi}",
      { kısa_açıklama: "El yapımı bıçak.", fiyat_cümlesi: "1.250 TL'den" },
      "El yapımı bıçak. 1.250 TL'den",
    ],
    [
      "an exclamation before the template's full stop",
      "{kısa_açıklama}. {fiyat_cümlesi}",
      { kısa_açıklama: "Yeni!", fiyat_cümlesi: "İndirimde" },
      "Yeni! İndirimde",
    ],
    [
      "a joiner left before a full stop",
      "{ürün_adı} - {kısa_açıklama}. {fiyat_cümlesi}",
      { kısa_açıklama: "", fiyat_cümlesi: "1.250 TL'den" },
      "Şef Bıçağı. 1.250 TL'den",
    ],
    [
      "a comma left before a joiner",
      "{ürün_adı}, {renk} | {mağaza}",
      { renk: "" },
      "Şef Bıçağı | Mağazam",
    ],
    [
      "breadcrumb joiners",
      "{kategori} › {ürün_adı} › {mağaza}",
      { kategori: "" },
      "Şef Bıçağı › Mağazam",
    ],
  ])("tidies %s", (_label, template, overrides, expected) => {
    expect(renderTemplate(template, { ...values, ...overrides })).toBe(expected)
  })

  it("keeps an ellipsis", () => {
    expect(renderTemplate("{ürün_adı}...", values)).toBe("Şef Bıçağı...")
  })

  it("reads own values only", () => {
    expect(renderTemplate("{constructor} | {ürün_adı}", values)).toBe("Şef Bıçağı")
  })

  it("stays linear on a long run of punctuation", () => {
    const long = `a${";".repeat(50_000)}b`
    const started = performance.now()

    renderTemplate("{kısa_açıklama};", { kısa_açıklama: long })

    expect(performance.now() - started).toBeLessThan(200)
  })
})

describe("withoutRepeatedParts", () => {
  it("drops a part that repeats an earlier one, with its joiner", () => {
    expect(withoutRepeatedParts("Balta Çakı | 21 cm - Kabza | My L'arte | My L'arte")).toBe(
      "Balta Çakı | 21 cm - Kabza | My L'arte"
    )
    expect(withoutRepeatedParts("My L'arte | My L'arte")).toBe("My L'arte")
    expect(withoutRepeatedParts("Kılıç – İSTANBUL  BIÇAK | istanbul bıçak")).toBe(
      "Kılıç – İSTANBUL  BIÇAK"
    )
  })

  it("keeps parts that only look alike and hyphens inside words", () => {
    expect(withoutRepeatedParts("N690-Böhler Çakı | N690 | Böhler")).toBe(
      "N690-Böhler Çakı | N690 | Böhler"
    )
    expect(withoutRepeatedParts("Keten Gömlek | Demo Mağaza")).toBe("Keten Gömlek | Demo Mağaza")
    expect(withoutRepeatedParts("")).toBe("")
  })
})
