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
