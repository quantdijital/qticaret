import type { CreateFulfillmentResult } from "@medusajs/framework/types"
import { fromMedusaAmount } from "../../lib/money"
import type { ShipInput } from "../../lib/shipping/carriers"
import { chooseQuote, offersOf } from "../../lib/shipping/geliver"
import type { GeliverOffer, GeliverShipment, QuoteChoice } from "../../lib/shipping/geliver"

/** The shipment's offer the option's choice takes: the cheapest, the fastest, or one service. */
export function pickOffer(shipment: GeliverShipment, choice: QuoteChoice): GeliverOffer | null {
  const offers = offersOf(shipment).flatMap((offer) => {
    const text = offer.totalAmount ?? offer.amount
    return text && offer.providerServiceCode
      ? [
          {
            offer,
            quote: {
              provider_code: offer.providerCode ?? null,
              service_code: offer.providerServiceCode,
              amount: fromMedusaAmount(text, { allowRounding: true }),
              estimated_hours: offer.averageEstimatedTime ?? null,
            },
          },
        ]
      : []
  })
  const quote = chooseQuote(
    [...offers.map(({ quote }) => quote)].sort((a, b) => a.amount - b.amount),
    choice
  )
  return offers.find((each) => each.quote === quote)?.offer ?? null
}

/**
 * What the fulfillment keeps of the shipment (adr/0031): Geliver's ids and
 * the label's address until our workflow stores the PDF privately. The
 * tracking number joins the labels once Geliver gives it.
 */
export function shipmentData(
  shipment: GeliverShipment,
  offer: GeliverOffer,
  ship: ShipInput
): CreateFulfillmentResult {
  return {
    data: {
      shipment_id: shipment.id,
      offer_id: offer.id,
      provider_code: offer.providerCode ?? null,
      service_code: offer.providerServiceCode ?? null,
      test: shipment.test === true,
      cash_on_delivery: ship.cash_on_delivery,
      status: shipment.statusCode ?? null,
      ...(shipment.labelURL ? { label_source: shipment.labelURL } : {}),
    },
    labels: shipment.trackingNumber
      ? [
          {
            tracking_number: shipment.trackingNumber,
            tracking_url: shipment.trackingUrl ?? "",
            label_url: "",
          },
        ]
      : [],
  }
}
