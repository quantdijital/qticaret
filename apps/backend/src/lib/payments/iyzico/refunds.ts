import { z } from "@medusajs/framework/zod"
import { iyzicoPrice } from "./amounts"

/**
 * iyzico's refund (v1, by item transaction), cancel and payment detail
 * (docs.iyzico.com "Refund & Cancel", "Retrieve Payment"; measured in the
 * sandbox 2026-10-27):
 * - a refund's answer is signed `paymentId:price:currency:conversationId`;
 * - one past what is left of its line is `5093`; iyzico counts its earlier
 *   refunds, but no answer lists them, the detail neither: our own record
 *   is the only one, and a refund whose answer was lost is not sent again;
 * - a cancel takes the whole payment back, the same day only, unsigned;
 * - the detail lists the item transactions (unsigned by any field order we
 *   could match): its amounts are used only after they add up to what the
 *   signed result said was paid, and iyzico caps each line itself.
 */

export const REFUND_PATH = "/payment/refund"
export const CANCEL_PATH = "/payment/cancel"
export const DETAIL_PATH = "/payment/detail"

const price = iyzicoPrice

export const refundAnswer = z.object({
  paymentId: z.string(),
  price,
  currency: z.string(),
  conversationId: z.string().optional(),
  signature: z.string().optional(),
})

export const cancelAnswer = z.object({ paymentId: z.string(), price, currency: z.string() })

export const detailAnswer = z.object({
  paymentId: z.string(),
  paymentStatus: z.string().optional(),
  fraudStatus: z.number().int().nullish(),
  price: price.optional(),
  paidPrice: price.optional(),
  currency: z.string().optional(),
  installment: z.number().int().nullish(),
  cardFamily: z.string().nullish(),
  cardAssociation: z.string().nullish(),
  cardType: z.string().nullish(),
  lastFourDigits: z.string().nullish(),
  itemTransactions: z
    .array(
      z.object({
        itemId: z.string(),
        paymentTransactionId: z.string(),
        paidPrice: price,
      })
    )
    .default([]),
})
