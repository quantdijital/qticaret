import { createHmac, randomUUID } from "node:crypto"
import type { IyzicoAccount } from "./signing"

/**
 * The fake iyzico's Checkout Form, as the sandbox answered on 2026-10-27:
 * initialize checks that the items add up to `price` (`5062`) and signs
 * `conversationId:token`; retrieve answers `5122` until the form is paid,
 * `5124` for a token it never gave, and signs a paid result. A form is
 * paid by a test (`pay`) or by a person on the fake's page (adr/0028).
 */

export interface FakeCheckoutForm {
  token: string
  conversationId: string
  basketId: string
  /** Lira as sent, e.g. "120.00". */
  price: string
  paidPrice: string
  currency: string
  callbackUrl: string
  enabledInstallments: number[]
  items: { id: string; price: string }[]
  result: null | {
    paymentStatus: "SUCCESS" | "FAILURE"
    paymentId: string
    fraudStatus: number
    installment: number
    /** What the card paid, surcharge included. */
    paidPrice: string
  }
}

export interface PayOutcome {
  status?: "SUCCESS" | "FAILURE"
  fraudStatus?: number
  installment?: number
  /** Lira paid when it differs from the form's (an installment surcharge). */
  paidPrice?: string
}

type Body = Record<string, unknown>

const kurusOf = (lira: string) => {
  const [whole = "0", fraction = ""] = lira.split(".")
  return Number(whole) * 100 + Number(fraction.padEnd(2, "0").slice(0, 2))
}

/** A price as signatures carry it: no trailing zeros ("10.50" → "10.5", "10.0" → "10"). */
const signed = (lira: string) =>
  lira.includes(".") ? lira.replace(/0+$/, "").replace(/\.$/, "") : lira

const sign = (account: IyzicoAccount, values: readonly string[]) =>
  createHmac("sha256", account.secretKey).update(values.join(":")).digest("hex")

const head = (body: Body) => ({
  locale: "tr",
  systemTime: Date.now(),
  conversationId: body["conversationId"],
})

const failure = (body: Body, errorCode: string, errorMessage: string) => ({
  body: { status: "failure", errorCode, errorMessage, ...head(body) },
})

export function createCheckoutForms(account: IyzicoAccount, pageBase: () => string) {
  const forms = new Map<string, FakeCheckoutForm>()
  let paid = 0

  const initialize = (body: Body) => {
    const items = Array.isArray(body["basketItems"]) ? (body["basketItems"] as Body[]) : []
    const buyer = body["buyer"] as Body | undefined
    const price = typeof body["price"] === "string" ? body["price"] : ""
    const paidPrice = typeof body["paidPrice"] === "string" ? body["paidPrice"] : ""
    const callbackUrl = typeof body["callbackUrl"] === "string" ? body["callbackUrl"] : ""
    if (!price || !paidPrice || !callbackUrl || !buyer?.["identityNumber"]) {
      return failure(body, "5004", "Zorunlu alan eksik")
    }
    if (items.some((item) => kurusOf(String(item["price"])) <= 0)) {
      return failure(body, "5050", "Sepet kalem tutarı 0'dan büyük olmalıdır")
    }
    if (items.reduce((sum, item) => sum + kurusOf(String(item["price"])), 0) !== kurusOf(price)) {
      return failure(
        body,
        "5062",
        "Gönderilen tutar tüm kırılımların toplam tutarına eşit olmalıdır"
      )
    }
    const token = randomUUID()
    const conversationId = String(body["conversationId"])
    forms.set(token, {
      token,
      conversationId,
      basketId: String(body["basketId"]),
      price,
      paidPrice,
      currency: String(body["currency"]),
      callbackUrl,
      enabledInstallments: (body["enabledInstallments"] as number[] | undefined) ?? [1],
      items: items.map((item) => ({ id: String(item["id"]), price: String(item["price"]) })),
      result: null,
    })
    return {
      body: {
        status: "success",
        ...head(body),
        token,
        tokenExpireTime: 1800,
        paymentPageUrl: `${pageBase()}/fake-cpp/${token}`,
        checkoutFormContent: "<script>/* fake */</script>",
        signature: sign(account, [conversationId, token]),
      },
    }
  }

  const retrieve = (body: Body) => {
    const form = forms.get(String(body["token"]))
    if (!form) {
      return failure(body, "5124", "token bulunamadı")
    }
    if (!form.result) {
      return failure(body, "5122", "Gönderilen tokena ait ödeme bilgisi bulunamadı")
    }
    const { result } = form
    const paidPrice = result.paidPrice
    const answer = {
      status: "success",
      ...head(body),
      paymentStatus: result.paymentStatus,
      paymentId: result.paymentId,
      fraudStatus: result.fraudStatus,
      price: Number(form.price),
      paidPrice: Number(paidPrice),
      currency: form.currency,
      basketId: form.basketId,
      installment: result.installment,
      cardAssociation: "MASTER_CARD",
      cardFamily: "Bonus",
      lastFourDigits: "0008",
      token: form.token,
      itemTransactions: form.items.map((item, index) => ({
        itemId: item.id,
        paymentTransactionId: `${result.paymentId}${String(index + 1).padStart(2, "0")}`,
        price: Number(item.price),
        paidPrice: Number(item.price),
      })),
    }
    return {
      body: {
        ...answer,
        signature: sign(account, [
          result.paymentStatus,
          result.paymentId,
          form.currency,
          form.basketId,
          form.conversationId,
          signed(String(Number(paidPrice))),
          signed(String(Number(form.price))),
          form.token,
        ]),
      },
    }
  }

  /** Completes a form as its page would; the shopper's browser then posts the token back. */
  const pay = (token: string, outcome: PayOutcome = {}) => {
    const form = forms.get(token)
    if (!form) {
      throw new Error(`no checkout form has the token ${token}`)
    }
    form.result = {
      paymentStatus: outcome.status ?? "SUCCESS",
      paymentId: String(20_000_000 + ++paid),
      fraudStatus: outcome.fraudStatus ?? 1,
      installment: outcome.installment ?? 1,
      paidPrice: outcome.paidPrice ?? form.paidPrice,
    }
    return form
  }

  return {
    forms,
    pay,
    handlers: {
      "/payment/iyzipos/checkoutform/initialize/auth/ecom": initialize,
      "/payment/iyzipos/checkoutform/auth/ecom/detail": retrieve,
    } as Readonly<Record<string, (body: Body) => { status?: number; body: unknown }>>,
  }
}
