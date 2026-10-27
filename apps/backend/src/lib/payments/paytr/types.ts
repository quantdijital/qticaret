import type { Kurus } from "../../money"
import type { PaytrSecrets } from "./signatures"

/** What the PayTR client takes and gives (dev.paytr.com, 2026-10-27). */

export interface PaytrCredentials extends PaytrSecrets {
  /** Test transactions on the shop's own account (PayTR has no separate test account). */
  testMode: boolean
}

export interface PaytrBasketLine {
  name: string
  /** Unit price, KDV included. */
  price: Kurus
  quantity: number
}

export interface PaytrTokenRequest {
  /** Letters and digits only, at most 64 (adr/0026: the session id without underscores). */
  merchantOid: string
  userIp: string
  email: string
  amount: Kurus
  /** Medusa's code (`try`). */
  currencyCode: string
  basket: readonly PaytrBasketLine[]
  /** 0 for the account's maximum, else 2–12. */
  maxInstallment: number
  noInstallment: boolean
  userName: string
  userAddress: string
  userPhone: string
  okUrl: string
  failUrl: string
  timeoutMinutes?: number
  lang?: "tr" | "en"
}

export interface PaytrRefundEntry {
  amount: Kurus
  date: string | null
  referenceNo: string | null
}

export interface PaytrPaymentStatus {
  /** What the shop asked for. */
  paymentAmount: Kurus
  /** What the card was charged: more with an installment surcharge. */
  totalAmount: Kurus
  currencyCode: string
  installments: number
  cardBrand: string | null
  /** The last four digits only; the rest of the masked number is not kept. */
  cardLast4: string | null
  paymentType: string | null
  testMode: boolean
  refunds: PaytrRefundEntry[]
}

export interface PaytrRefund {
  amount: Kurus
  referenceNo: string | null
  testMode: boolean
}

export interface PaytrInstallmentRates {
  /** The most installments the shop may offer; null when PayTR does not say. */
  maxInstallment: number | null
  /** Card family (`world`, `bonus` ...) → installment count → rate in percent. */
  rates: Record<string, Record<number, number>>
}

/** Whether PayTR accepted the shop's account details (adr/0027 §4). */
export type PaytrCredentialCheck = "valid" | "merchant_invalid" | "secret_invalid"
