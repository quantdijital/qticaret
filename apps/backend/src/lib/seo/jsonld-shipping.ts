import type { JsonLd } from "./jsonld-base"

/** Working days to leave and to arrive (Settings > Shipping, F7.8). */
export interface DeliveryFacts {
  handling: [number, number]
  transit: [number, number]
}

const days = ([min, max]: [number, number]): JsonLd => ({
  "@type": "QuantitativeValue",
  minValue: min,
  maxValue: max,
  unitCode: "DAY",
})

/** Google's `OfferShippingDetails`: the rate, Türkiye, and the handling and transit days. */
export function shippingDetailsOf(rate: number, delivery: DeliveryFacts): JsonLd {
  return {
    "@type": "OfferShippingDetails",
    shippingRate: { "@type": "MonetaryAmount", value: rate.toFixed(2), currency: "TRY" },
    shippingDestination: { "@type": "DefinedRegion", addressCountry: "TR" },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: days(delivery.handling),
      transitTime: days(delivery.transit),
    },
  }
}
