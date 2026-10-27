import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"
import { useOrderMutation } from "./orders"

/**
 * An order's payments (F5 V7, F6): the provider's own record, the shop's
 * refunds, a bank transfer's state, and the money taken in by hand.
 */

/** The shop saw the bank transfer's money come in: the order's payment is taken (F6 W2). */
export const useConfirmBankTransfer = (id: string) =>
  useOrderMutation(() =>
    sdk.client.fetch(`/admin/orders/${encodeURIComponent(id)}/bank-transfer/confirm`, {
      method: "POST",
      body: {},
    })
  )

export const useCapturePayment = () =>
  useOrderMutation(async (paymentIds: string[]) => {
    for (const paymentId of paymentIds) {
      await sdk.admin.payment.capture(paymentId, {})
    }
  })

/** One of the order's hosted-form payments as its provider holds it (F5 V7, V10); amounts as exact lira. */
export interface HostedPayment {
  payment_id: string
  provider_id: string
  reference: string | null
  test_mode: boolean
  /** False when the provider could not be asked just now. */
  available: boolean
  error_code: string | null
  amount: string | null
  total: string | null
  installments: number | null
  card_brand: string | null
  card_last4: string | null
  /** iyzico's fraud check: 1 approved, 0 under review, -1 refused; null for PayTR. */
  fraud_status: number | null
  refunds: { amount: string; date: string | null; reference: string | null }[]
}

export interface ShopRefund {
  reference: string
  amount: string
  status: "pending" | "done" | "failed"
  note: string | null
  created_at: string
}

/** A bank transfer order's state (F6, adr/0029). */
export interface BankTransferState {
  awaiting: boolean
  deadline: string | null
  confirmed_at: string | null
}

export interface PaymentDetails {
  payments: HostedPayment[]
  refunds: ShopRefund[]
  bank_transfer: BankTransferState | null
}

/** `GET /admin/orders/:id/payment-details`: asked of the provider when the page opens. */
export const orderPaymentDetailsQuery = (id: string) =>
  queryOptions({
    queryKey: ["orders", "payment-details", id],
    queryFn: () =>
      sdk.client.fetch<PaymentDetails>(`/admin/orders/${encodeURIComponent(id)}/payment-details`),
  })
