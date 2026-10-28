import { productJsonLd } from "../jsonld"
import type { ProductFacts } from "../jsonld"
import { shippingSentence } from "../resolve"

const facts = (shippingRate: number | null): ProductFacts => ({
  name: "Şef Bıçağı",
  description: "Paslanmaz çelik.",
  images: [],
  brand: null,
  condition: "new",
  groupId: "sef-bicagi",
  variesBy: [],
  variants: [
    {
      id: "variant_1",
      name: "Şef Bıçağı",
      sku: "SB-1",
      gtin: null,
      mpn: null,
      image: null,
      price: 899,
      availability: "InStock",
      properties: {},
      shippingRate,
    },
  ],
  delivery: { handling: [1, 2], transit: [1, 3] },
})

describe("shipping in structured data (F7.8, docs/13 §5)", () => {
  it("gives an offer its shipping details when the shop's table prices it", () => {
    const offer = productJsonLd(facts(49.9), "https://magaza.example.com/urun/sef-bicagi")["offers"]

    expect(offer).toMatchObject({
      shippingDetails: {
        "@type": "OfferShippingDetails",
        shippingRate: { "@type": "MonetaryAmount", value: "49.90", currency: "TRY" },
        shippingDestination: { "@type": "DefinedRegion", addressCountry: "TR" },
        deliveryTime: {
          handlingTime: { minValue: 1, maxValue: 2, unitCode: "DAY" },
          transitTime: { minValue: 1, maxValue: 3, unitCode: "DAY" },
        },
      },
    })
  })

  it("writes none without a rate: a guessed one would mislead", () => {
    const offer = productJsonLd(facts(null), "https://magaza.example.com/urun/sef-bicagi")["offers"]

    expect(offer).not.toHaveProperty("shippingDetails")
  })

  it("says when an order leaves, in working days", () => {
    expect(shippingSentence(1, 2)).toBe("1–2 iş gününde kargoda.")
    expect(shippingSentence(2, 2)).toBe("2 iş gününde kargoda.")
    expect(shippingSentence(0, 0)).toBe("Aynı gün kargoda.")
  })
})
