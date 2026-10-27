import { z } from "@medusajs/framework/zod"

/**
 * Geliver's answers as the platform reads them (adr/0031), from the
 * official SDK's models (`GeliverApp/geliver-js`). Every object stays loose:
 * Geliver adds fields freely. Amounts come as decimal strings ("150.50").
 */

/** `{ result, data, code, message }`; a list keeps its page fields beside `data`. */
export const geliverEnvelope = z
  .object({
    result: z.boolean().optional(),
    data: z.unknown().optional(),
    code: z.unknown().optional(),
  })
  .loose()

const text = z.string().nullish()

export const geliverAddress = z
  .object({
    id: z.string().min(1),
    shortName: text,
    name: text,
    address1: text,
    cityCode: text,
    districtName: text,
    zip: text,
    phone: text,
    isRecipientAddress: z.boolean().nullish(),
  })
  .loose()

export type GeliverAddress = z.infer<typeof geliverAddress>

export const geliverAddressList = z.array(geliverAddress)

const amountText = z.union([z.string(), z.number()]).transform(String).nullish()
const count = z.union([z.string(), z.number()]).transform(Number).nullish()

export const geliverOffer = z
  .object({
    id: z.string().min(1),
    providerCode: text,
    providerServiceCode: text,
    totalAmount: amountText,
    amount: amountText,
    currency: text,
    averageEstimatedTime: z.number().nullish(),
  })
  .loose()

export type GeliverOffer = z.infer<typeof geliverOffer>

export const geliverTracking = z
  .object({
    trackingStatusCode: text,
    trackingSubStatusCode: text,
    statusDate: text,
    locationName: text,
  })
  .loose()

export const geliverShipment = z
  .object({
    id: z.string().min(1),
    statusCode: text,
    test: z.boolean().nullish(),
    isReturn: z.boolean().nullish(),
    trackingNumber: text,
    trackingUrl: text,
    barcode: text,
    labelURL: text,
    providerServiceCode: text,
    acceptedOfferID: text,
    offers: z
      .object({
        cheapest: geliverOffer.nullish(),
        fastest: geliverOffer.nullish(),
        list: z.array(geliverOffer).nullish(),
        percentageCompleted: count,
      })
      .loose()
      .nullish(),
    trackingStatus: geliverTracking.nullish(),
  })
  .loose()

export type GeliverShipment = z.infer<typeof geliverShipment>

/** Accepting an offer: the label bought, the shipment as it now stands. */
export const geliverTransaction = z
  .object({ id: z.string().nullish(), shipment: geliverShipment.nullish() })
  .loose()
