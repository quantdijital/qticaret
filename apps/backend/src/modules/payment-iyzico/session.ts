import { z } from "@medusajs/framework/zod"
import { ValidationError } from "../../lib/errors"
import { PAYMENT_SESSION_ID } from "../../lib/payments/checkout"
import type { CheckoutFormResult } from "../../lib/payments/iyzico"

/** What a started iyzico session keeps (public: nothing personal); anything else is not one of ours. */
const sessionData = z.object({
  // Our session id: iyzico's conversation and basket
  conversation_id: z.string().regex(PAYMENT_SESSION_ID),
  token: z.string().min(1).max(200),
  amount: z.number().int().positive(),
  currency_code: z.string().length(3),
  test_mode: z.boolean(),
  return_urls: z.object({ success: z.url(), failure: z.url() }),
})

export type IyzicoSession = z.infer<typeof sessionData>

export function iyzicoSession(data: Record<string, unknown> | undefined): IyzicoSession {
  const session = sessionData.safeParse(data)
  if (!session.success) {
    throw new ValidationError("payments.session_invalid")
  }
  return session.data
}

/**
 * Whether a form's result pays this session: iyzico's basket is our session,
 * and it asked the amount and currency the session expected. The card may
 * pay more than `price` (an installment surcharge), never less.
 */
export function resultMatches(session: IyzicoSession, result: CheckoutFormResult): boolean {
  return (
    result.basketId === session.conversation_id &&
    result.price === session.amount &&
    result.paidPrice !== null &&
    result.paidPrice >= session.amount &&
    result.currency === session.currency_code.toUpperCase()
  )
}

/**
 * The payment's facts Medusa keeps, for refunds by line (F5 V10). Medusa
 * writes them to the session too, which Store responses show: nothing
 * about the card; the panel asks iyzico for that (as PayTR's details).
 */
export function paymentFactsOf(result: CheckoutFormResult): Record<string, unknown> {
  return {
    payment_id: result.paymentId,
    fraud_status: result.fraudStatus,
    paid_price: result.paidPrice,
    installment: result.installment,
    item_transactions: result.items.map((item) => ({
      item_id: item.itemId,
      transaction_id: item.transactionId,
      paid: item.paid,
    })),
  }
}
