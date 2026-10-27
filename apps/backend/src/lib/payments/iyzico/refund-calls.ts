import type { z } from "@medusajs/framework/zod"
import type { Kurus } from "../../money"
import type { ProviderError } from "../../errors"
import { parseIyzicoPrice, toIyzicoPrice } from "./amounts"
import {
  CANCEL_PATH,
  DETAIL_PATH,
  REFUND_PATH,
  cancelAnswer,
  detailAnswer,
  refundAnswer,
} from "./refunds"
import { isResponseGenuine, signaturePrice } from "./signatures"
import type { IyzicoCredentials } from "./types"

/** The client's signed call (`client.ts`). */
export type IyzicoPost = <T>(
  credentials: IyzicoCredentials,
  path: string,
  payload: Record<string, unknown>,
  schema: z.ZodType<T>,
  call?: { idempotent?: boolean; signal?: AbortSignal | undefined }
) => Promise<T>

/** Refund, cancel and payment detail (F5 V10) over the client's signed call. */
export function refundCalls(post: IyzicoPost, forged: () => ProviderError) {
  /**
   * Gives back `amount` of one item transaction; never sent twice by the
   * client (iyzico is not idempotent). The answer's signature is checked.
   */
  async function refundTransaction(
    credentials: IyzicoCredentials,
    refund: { transactionId: string; amount: Kurus; currency: string; conversationId: string }
  ): Promise<{ paymentId: string; amount: Kurus; currency: string; conversationId: string }> {
    const answer = await post(
      credentials,
      REFUND_PATH,
      {
        locale: "tr",
        conversationId: refund.conversationId,
        paymentTransactionId: refund.transactionId,
        price: toIyzicoPrice(refund.amount),
        currency: refund.currency.toUpperCase(),
      },
      refundAnswer
    )
    const signed = [
      answer.paymentId,
      signaturePrice(answer.price),
      answer.currency,
      answer.conversationId ?? "",
    ]
    if (!isResponseGenuine(credentials.secretKey, signed, answer.signature)) {
      throw forged()
    }
    return {
      paymentId: answer.paymentId,
      amount: parseIyzicoPrice(answer.price),
      currency: answer.currency,
      conversationId: answer.conversationId ?? "",
    }
  }

  /** Takes the whole payment back, the same day only; a later day needs refunds. */
  async function cancelPayment(
    credentials: IyzicoCredentials,
    cancel: { paymentId: string; conversationId: string }
  ): Promise<{ amount: Kurus }> {
    const answer = await post(
      credentials,
      CANCEL_PATH,
      { locale: "tr", conversationId: cancel.conversationId, paymentId: cancel.paymentId },
      cancelAnswer
    )
    return { amount: parseIyzicoPrice(answer.price) }
  }

  /** A payment as iyzico holds it now: its item transactions, the card, the fraud check. */
  async function paymentDetail(credentials: IyzicoCredentials, paymentId: string) {
    return post(credentials, DETAIL_PATH, { locale: "tr", paymentId }, detailAnswer, {
      idempotent: true,
    })
  }

  return { refundTransaction, cancelPayment, paymentDetail }
}
