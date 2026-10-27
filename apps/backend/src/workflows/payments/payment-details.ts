import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { isProviderError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { PAYTR_PAYMENT_PROVIDER_ID } from "../../lib/payments/checkout"
import { paytrApi, paytrCredentialsOf } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"

/** What PayTR holds for one of the order's payments, read when the shop looks (F5 V7). */
export interface HostedPaymentDetails {
  payment_id: string
  provider_id: string
  /** PayTR's `merchant_oid`. */
  reference: string | null
  test_mode: boolean
  /** False when PayTR could not be asked just now: the rest is empty. */
  available: boolean
  error_code: string | null
  /** Kuruş the shop asked for, and what PayTR charged with the surcharge. */
  amount: number | null
  total: number | null
  installments: number | null
  card_brand: string | null
  card_last4: string | null
  payment_type: string | null
  refunds: { amount: number; date: string | null; reference: string | null }[]
}

export interface OrderRefundEntry {
  reference: string
  amount: number
  status: string
  note: string | null
  created_by: string | null
  created_at: string
}

/**
 * The order's hosted-form payments as PayTR holds them, and the refunds the
 * shop made (F5 V7). Card details are asked of PayTR, never kept: a
 * session's data is public, an order's payment is read here only.
 */
export async function orderPaymentDetails(
  container: MedusaContainer,
  orderId: string
): Promise<{ payments: HostedPaymentDetails[]; refunds: OrderRefundEntry[] }> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.data",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as
    | {
        payment_collections?:
          | ({
              payments?:
                | ({
                    id: string
                    provider_id: string
                    data?: Record<string, unknown> | null
                  } | null)[]
                | null
            } | null)[]
          | null
      }
    | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  const hosted = (order.payment_collections ?? [])
    .flatMap((collection) => collection?.payments ?? [])
    .filter(
      (payment): payment is NonNullable<typeof payment> =>
        payment?.provider_id === PAYTR_PAYMENT_PROVIDER_ID
    )
  const account = hosted.length
    ? paytrCredentialsOf(
        await container
          .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
          .read("paytr")
      )
    : null
  const payments = await Promise.all(
    hosted.map(async (payment): Promise<HostedPaymentDetails> => {
      const reference =
        typeof payment.data?.["merchant_oid"] === "string" ? payment.data["merchant_oid"] : null
      const base: HostedPaymentDetails = {
        payment_id: payment.id,
        provider_id: payment.provider_id,
        reference,
        test_mode: payment.data?.["test_mode"] === true,
        available: false,
        error_code: null,
        amount: null,
        total: null,
        installments: null,
        card_brand: null,
        card_last4: null,
        payment_type: null,
        refunds: [],
      }
      if (!account || !reference) {
        return { ...base, error_code: account ? "reference_missing" : "not_configured" }
      }
      try {
        const paid = await paytrApi().queryStatus(account, reference)
        if (!paid) {
          return { ...base, error_code: "payment_not_found" }
        }
        return {
          ...base,
          available: true,
          test_mode: paid.testMode,
          amount: paid.paymentAmount,
          total: paid.totalAmount,
          installments: paid.installments,
          card_brand: paid.cardBrand,
          card_last4: paid.cardLast4,
          payment_type: paid.paymentType,
          refunds: paid.refunds.map((refund) => ({
            amount: refund.amount,
            date: refund.date,
            reference: refund.referenceNo,
          })),
        }
      } catch (error) {
        logger.warn({
          event: "paytr.payment_details_failed",
          paymentId: payment.id,
          err: errorSummary(error),
        })
        return { ...base, error_code: isProviderError(error) ? error.providerCode : "error" }
      }
    })
  )
  const refunds = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .listOrderRefunds(
      { order_id: orderId },
      {
        select: ["reference", "amount", "status", "note", "created_by", "created_at"],
        order: { created_at: "ASC" },
      }
    )
  return {
    payments,
    refunds: refunds.map((refund) => ({
      reference: refund.reference,
      amount: refund.amount,
      status: refund.status,
      note: refund.note,
      created_by: refund.created_by,
      created_at: new Date(refund.created_at).toISOString(),
    })),
  }
}
