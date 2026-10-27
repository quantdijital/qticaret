import { randomBytes } from "node:crypto"
import { paytrSign } from "./signing"
import type { PaytrAccount } from "./signing"

/**
 * The fake PayTR's answers per API (dev.paytr.com, 2026-10-27): the
 * signature and the account checked first, then the payment it knows.
 */

export interface FakePayment {
  merchantOid: string
  /** Kuruş the shop asked for. */
  paymentAmount: number
  /** Kuruş charged, surcharge included. */
  totalAmount: number
  currency: string
  testMode: boolean
  installments: number
  status: "pending" | "success" | "failed"
  /** The shop answered "OK" to the notification; refunds need it (`007`). */
  notified: boolean
  refunds: { amount: number; referenceNo: string | null }[]
  /** The iFrame's token, and where the form sends the shopper back. */
  formToken: string
  okUrl: string
  failUrl: string
  /** The most installments the shop allows for this payment (`max_installment`, 0 = PayTR's). */
  maxInstallment: number
}

/** PayTR's surcharge percentages per installment count (one card family is enough here). */
export const FAKE_INSTALLMENT_RATES: Readonly<Record<string, string>> = {
  taksit_2: "3.49",
  taksit_3: "4.69",
  taksit_6: "8.29",
  taksit_12: "15.9",
}

export type Fields = Record<string, string>
export interface Reply {
  status?: number
  body: unknown
}

const LIRA = /^\d{1,13}(\.\d{1,2})?$/

/** "10,8" for 1080 kuruş: the status query writes lira with a comma (dev.paytr.com). */
const commaLira = (kurus: number): string => {
  const fraction = String(kurus % 100)
    .padStart(2, "0")
    .replace(/0+$/, "")
  return fraction === ""
    ? String(Math.floor(kurus / 100))
    : `${String(Math.floor(kurus / 100))},${fraction}`
}
const dotLira = (kurus: number): string =>
  `${String(Math.floor(kurus / 100))}.${String(kurus % 100).padStart(2, "0")}`

const error = (errNo: string, message: string): Reply => ({
  body: { status: "error", err_no: errNo, err_msg: message },
})

export function createFakePaytrHandlers(account: PaytrAccount, payments: Map<string, FakePayment>) {
  const signed = (fields: Fields, parts: readonly string[]) =>
    fields["paytr_token"] === paytrSign(account, parts)

  const token = (fields: Fields): Reply => {
    const parts = [
      fields["merchant_id"] ?? "",
      fields["user_ip"] ?? "",
      fields["merchant_oid"] ?? "",
      fields["email"] ?? "",
      fields["payment_amount"] ?? "",
      fields["user_basket"] ?? "",
      fields["no_installment"] ?? "",
      fields["max_installment"] ?? "",
      fields["currency"] ?? "",
      fields["test_mode"] ?? "",
    ]
    const required = [
      "user_name",
      "user_address",
      "user_phone",
      "merchant_ok_url",
      "merchant_fail_url",
    ]
    const missing = required.find((name) => !fields[name])
    if (fields["merchant_id"] !== account.merchantId || missing) {
      const field = missing ?? "merchant_id"
      return { body: { status: "failed", reason: `Zorunlu alan degeri gecersiz: ${field}` } }
    }
    if (!signed(fields, parts)) {
      return { body: { status: "failed", reason: "paytr_token gecersiz" } }
    }
    const oid = fields["merchant_oid"] ?? ""
    const amount = Number(fields["payment_amount"])
    if (!/^[A-Za-z0-9]{1,64}$/.test(oid) || !Number.isSafeInteger(amount) || amount < 100) {
      return { body: { status: "failed", reason: "Zorunlu alan degeri gecersiz: merchant_oid" } }
    }
    const basket: unknown = JSON.parse(
      Buffer.from(fields["user_basket"] ?? "", "base64").toString()
    )
    if (!Array.isArray(basket) || basket.length === 0) {
      return { body: { status: "failed", reason: "Zorunlu alan degeri gecersiz: user_basket" } }
    }
    const formToken = randomBytes(26).toString("hex")
    payments.set(oid, {
      merchantOid: oid,
      paymentAmount: amount,
      totalAmount: amount,
      currency: fields["currency"] ?? "TL",
      testMode: fields["test_mode"] === "1",
      installments: 1,
      status: "pending",
      notified: false,
      refunds: [],
      formToken,
      okUrl: fields["merchant_ok_url"] ?? "",
      failUrl: fields["merchant_fail_url"] ?? "",
      maxInstallment: fields["no_installment"] === "1" ? 1 : Number(fields["max_installment"] ?? 0),
    })
    return { body: { status: "success", token: formToken } }
  }

  const status = (fields: Fields): Reply => {
    const oid = fields["merchant_oid"] ?? ""
    if (fields["merchant_id"] !== account.merchantId) {
      return error("001", "Gecersiz istek veya magaza aktif degil")
    }
    if (!signed(fields, [account.merchantId, oid])) {
      return error("003", "paytr_token gonderilmedi veya gecersiz")
    }
    const payment = payments.get(oid)
    if (payment?.status !== "success") {
      return error("004", "merchant_oid ile basarili odeme bulunamadi")
    }
    const refunded = payment.refunds.reduce((sum, entry) => sum + entry.amount, 0)
    return {
      body: {
        status: "success",
        payment_amount: commaLira(payment.paymentAmount),
        payment_total: commaLira(payment.totalAmount),
        currency: payment.currency,
        taksit: String(payment.installments > 1 ? payment.installments : 0),
        kart_marka: "WORLD",
        masked_pan: "455359******6747",
        odeme_tipi: "KART",
        test_mode: payment.testMode ? "1" : "0",
        net_tutar: dotLira(payment.totalAmount - refunded),
        kesinti_tutari: "0.00",
        ...(payment.refunds.length === 0
          ? {}
          : {
              returns: payment.refunds.map((entry) => ({
                return_amount: dotLira(entry.amount),
                return_date: "2026-10-27 12:00:00",
                ...(entry.referenceNo ? { reference_no: entry.referenceNo } : {}),
              })),
            }),
      },
    }
  }

  const refund = (fields: Fields): Reply => {
    const oid = fields["merchant_oid"] ?? ""
    const amountText = fields["return_amount"] ?? ""
    if (fields["merchant_id"] !== account.merchantId) {
      return error("001", "Gecersiz istek veya magaza aktif degil")
    }
    if (!LIRA.test(amountText)) {
      return error("003", "return_amount gonderilmedi veya gecersiz")
    }
    if (!signed(fields, [account.merchantId, oid, amountText])) {
      return error("004", "paytr_token gonderilmedi veya gecersiz")
    }
    const payment = payments.get(oid)
    if (payment?.status !== "success") {
      return error("005", "merchant_oid ile basarili odeme bulunamadi")
    }
    if (!payment.notified) {
      return error("007", "Odeme siteye bildirilmedi")
    }
    const [lira = "0", fraction = ""] = amountText.split(".")
    const amount = Number(lira) * 100 + Number(fraction.padEnd(2, "0"))
    const refunded = payment.refunds.reduce((sum, entry) => sum + entry.amount, 0)
    if (refunded + amount > payment.paymentAmount) {
      return error("009", "Toplam iade tutari odeme tutarindan fazla olamaz")
    }
    const referenceNo = fields["reference_no"] ?? null
    payment.refunds.push({ amount, referenceNo })
    return {
      body: {
        status: "success",
        is_test: payment.testMode ? 1 : 0,
        merchant_oid: oid,
        return_amount: amountText,
        ...(referenceNo ? { reference_no: referenceNo } : {}),
      },
    }
  }

  const installments = (fields: Fields): Reply => {
    if (fields["merchant_id"] !== account.merchantId) {
      return error("001", "Gecersiz istek veya magaza aktif degil")
    }
    if (!signed(fields, [account.merchantId, fields["request_id"] ?? ""])) {
      return error("004", "paytr_token gonderilmedi veya gecersiz")
    }
    const rates = FAKE_INSTALLMENT_RATES
    return {
      body: {
        status: "success",
        request_id: fields["request_id"],
        max_inst_non_bus: "12",
        oranlar: { world: rates, bonus: rates, axess: { taksit_2: "3.59" } },
      },
    }
  }

  return {
    "/odeme/api/get-token": token,
    "/odeme/durum-sorgu": status,
    "/odeme/iade": refund,
    "/odeme/taksit-oranlari": installments,
  } as Readonly<Record<string, (fields: Fields) => Reply>>
}
