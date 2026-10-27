import { createHmac } from "node:crypto"
import type { FakeCheckoutForm } from "./checkout-form"
import type { IyzicoAccount } from "./signing"

/**
 * The fake iyzico's refund (v1, by item transaction) and cancel, as the
 * sandbox answered on 2026-10-27: a refund past what is left of its line
 * is `5093`; a refund's answer is signed `paymentId:price:currency:conversationId`;
 * a cancel takes the whole payment back and carries no signature. Codes
 * the sandbox was not seen to give are the fake's own (`FAKE_*`).
 */

type Body = Record<string, unknown>

const kurusOf = (value: unknown) => Math.round(Number(value) * 100)
const lira = (kurus: number) => String(kurus / 100)

export function createRefunds(account: IyzicoAccount, forms: Map<string, FakeCheckoutForm>) {
  /** Kuruş given back per item transaction, in order. */
  const refunds = new Map<string, number[]>()
  const cancelled = new Set<string>()

  const head = (body: Body) => ({
    locale: "tr",
    systemTime: Date.now(),
    conversationId: body["conversationId"],
  })
  const failure = (body: Body, errorCode: string, errorMessage: string) => ({
    body: { status: "failure", errorCode, errorMessage, retryable: false, ...head(body) },
  })
  const paidForms = () =>
    [...forms.values()].filter((form) => form.result?.paymentStatus === "SUCCESS")

  /** The item transaction behind an id, with its paid amount. */
  const transaction = (id: string) => {
    for (const form of paidForms()) {
      const index = form.items.findIndex(
        (_, i) => `${form.result?.paymentId ?? ""}${String(i + 1).padStart(2, "0")}` === id
      )
      if (index >= 0) {
        return { form, paid: kurusOf(form.items[index]?.price) }
      }
    }
    return null
  }

  const refund = (body: Body) => {
    const id = typeof body["paymentTransactionId"] === "string" ? body["paymentTransactionId"] : ""
    const found = transaction(id)
    if (!found?.form.result) {
      return failure(body, "FAKE_UNKNOWN_TRANSACTION", "Ödeme kırılımı bulunamadı")
    }
    const paymentId = found.form.result.paymentId
    if (cancelled.has(paymentId)) {
      return failure(body, "FAKE_CANCELLED", "İptal edilmiş ödeme iade edilemez")
    }
    const amount = kurusOf(body["price"])
    const before = refunds.get(id) ?? []
    if (before.reduce((sum, part) => sum + part, 0) + amount > found.paid) {
      return failure(
        body,
        "5093",
        "Ödeme kırılımına ait verilen iade tutarı ve önceden iade edilen toplam tutar kırılımın tutarından büyük olamaz"
      )
    }
    refunds.set(id, [...before, amount])
    const conversationId = typeof body["conversationId"] === "string" ? body["conversationId"] : ""
    const currency = found.form.currency
    return {
      body: {
        status: "success",
        ...head(body),
        paymentId,
        paymentTransactionId: id,
        price: amount / 100,
        currency,
        authCode: "000000",
        hostReference: "fake",
        refundHostReference: "fake",
        retryable: false,
        signature: createHmac("sha256", account.secretKey)
          .update([paymentId, lira(amount), currency, conversationId].join(":"))
          .digest("hex"),
      },
    }
  }

  const cancel = (body: Body) => {
    const paymentId = typeof body["paymentId"] === "string" ? body["paymentId"] : ""
    const form = paidForms().find((candidate) => candidate.result?.paymentId === paymentId)
    if (!form?.result) {
      return failure(body, "FAKE_UNKNOWN_PAYMENT", "Ödeme bulunamadı")
    }
    const refunded = form.items.some((_, i) =>
      refunds.has(`${paymentId}${String(i + 1).padStart(2, "0")}`)
    )
    if (cancelled.has(paymentId) || refunded) {
      return failure(body, "FAKE_NOT_CANCELLABLE", "Ödeme iptal edilemez")
    }
    cancelled.add(paymentId)
    return {
      body: {
        status: "success",
        ...head(body),
        paymentId,
        price: Number(form.result.paidPrice),
        currency: form.currency,
        authCode: "000000",
        hostReference: "fake",
        cancelHostReference: "fake",
      },
    }
  }

  return {
    refunds,
    cancelled,
    handlers: { "/payment/refund": refund, "/payment/cancel": cancel } as Readonly<
      Record<string, (body: Body) => { status?: number; body: unknown }>
    >,
  }
}
