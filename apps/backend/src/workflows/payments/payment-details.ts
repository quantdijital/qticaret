import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { bankTransferOf, confirmedAt, transferDeadline } from "../../lib/payments/bank-transfer"
import type { BankTransferOrderRow } from "../../lib/payments/bank-transfer"
import {
  IYZICO_PAYMENT_PROVIDER_ID,
  PAYTR_PAYMENT_PROVIDER_ID,
  isHostedFormProvider,
} from "../../lib/payments/checkout"
import { iyzicoCredentialsOf } from "../../lib/payments/iyzico"
import { paytrCredentialsOf } from "../../lib/payments/paytr"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type IntegrationCredentialsModuleService from "../../modules/integration-credentials/service"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { UNSETTLED } from "../orders/refund-settle"
import { iyzicoDetails } from "./iyzico-details"
import { paytrDetails } from "./paytr-details"

/** What the provider holds for one of the order's payments, read when the shop looks (F5 V7, V10). */
export interface HostedPaymentDetails {
  payment_id: string
  provider_id: string
  /** PayTR's `merchant_oid`, iyzico's `paymentId`. */
  reference: string | null
  test_mode: boolean
  /** False when the provider could not be asked just now: the rest is empty. */
  available: boolean
  error_code: string | null
  /** Kuruş the shop asked for, and what the card paid with the surcharge. */
  amount: number | null
  total: number | null
  installments: number | null
  card_brand: string | null
  card_last4: string | null
  payment_type: string | null
  /** iyzico's fraud check: 1 approved, 0 under review, -1 refused; null for PayTR. */
  fraud_status: number | null
  refunds: { amount: number; date: string | null; reference: string | null }[]
}

/** A bank transfer order's state (adr/0029): awaiting the money until, or confirmed when. */
export interface BankTransferState {
  awaiting: boolean
  deadline: string | null
  confirmed_at: string | null
}

export interface OrderRefundEntry {
  reference: string
  amount: number
  status: string
  /** Pending with its money gone, or maybe gone, its record not closed: the shop checks the provider. */
  incomplete: boolean
  /** Whose payment it gave back: `paytr`, `iyzico`, `bank-transfer`, `cod`; null when unknown. */
  provider: string | null
  /** The reference as the provider was given it (PayTR: letters and digits, at most 64). */
  sent_as: string
  /** iyzico's parts (kuruş), each answered (`done`) or its answer lost (`sending`). */
  parts: { amount: number; state: string }[]
  note: string | null
  created_by: string | null
  created_at: string
}

interface PaymentRow {
  id: string
  provider_id: string
  data?: Record<string, unknown> | null
}

interface OrderRow extends BankTransferOrderRow {
  payment_collections?: (NonNullable<BankTransferOrderRow["payment_collections"]>[number] & {
    payments?: (PaymentRow | null)[] | null
  })[]
}

/** A payment's details before its provider is asked: what the payment itself keeps. */
const unread = (payment: PaymentRow): HostedPaymentDetails => ({
  payment_id: payment.id,
  provider_id: payment.provider_id,
  reference:
    typeof payment.data?.["merchant_oid"] === "string" ? payment.data["merchant_oid"] : null,
  test_mode: payment.data?.["test_mode"] === true,
  available: false,
  error_code: null,
  amount: null,
  total: null,
  installments: null,
  card_brand: null,
  card_last4: null,
  payment_type: null,
  fraud_status: null,
  refunds: [],
})

async function readOrder(container: MedusaContainer, orderId: string): Promise<OrderRow> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: [
      "created_at",
      "payment_collections.status",
      "payment_collections.payments.id",
      "payment_collections.payments.provider_id",
      "payment_collections.payments.data",
      "payment_collections.payment_sessions.provider_id",
      "payment_collections.payment_sessions.data",
    ],
    filters: { id: orderId },
  })
  const order = data[0] as OrderRow | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  return order
}

/**
 * The order's hosted-form payments as their provider holds them, its bank
 * transfer's state, and the refunds the shop made (F5 V7, V10; F6). Card
 * details are asked of the provider, never kept: a session's data is
 * public, an order's payment is read here only.
 */
export async function orderPaymentDetails(
  container: MedusaContainer,
  orderId: string
): Promise<{
  payments: HostedPaymentDetails[]
  refunds: OrderRefundEntry[]
  bank_transfer: BankTransferState | null
}> {
  const order = await readOrder(container, orderId)
  const hosted = (order.payment_collections ?? [])
    .flatMap((collection) => collection.payments ?? [])
    .filter((payment): payment is PaymentRow => isHostedFormProvider(payment?.provider_id ?? ""))
  const accounts = container.resolve<IntegrationCredentialsModuleService>(
    INTEGRATION_CREDENTIALS_MODULE
  )
  const uses = (providerId: string) => hosted.some(({ provider_id }) => provider_id === providerId)
  const [paytr, iyzico, refunds] = await Promise.all([
    uses(PAYTR_PAYMENT_PROVIDER_ID) ? accounts.read("paytr").then(paytrCredentialsOf) : null,
    uses(IYZICO_PAYMENT_PROVIDER_ID) ? accounts.read("iyzico").then(iyzicoCredentialsOf) : null,
    container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE).listOrderRefunds(
      { order_id: orderId },
      {
        select: [
          "reference",
          "payment_id",
          "amount",
          "status",
          "error_code",
          "provider_parts",
          "note",
          "created_by",
          "created_at",
        ],
        order: { created_at: "ASC" },
      }
    ),
  ])
  // Every payment's provider, a refund's own included (a transfer, cash at the door)
  const providerOf = new Map(
    (order.payment_collections ?? [])
      .flatMap((collection) => collection.payments ?? [])
      .flatMap((payment) => (payment ? [[payment.id, payment.provider_id] as const] : []))
  )
  const payments = await Promise.all(
    hosted.map((payment) =>
      payment.provider_id === IYZICO_PAYMENT_PROVIDER_ID
        ? iyzicoDetails(
            iyzico,
            payment,
            unread(payment),
            refunds.filter((refund) => refund.payment_id === payment.id)
          )
        : paytrDetails(paytr, payment.id, unread(payment))
    )
  )
  return {
    payments,
    bank_transfer: bankTransferState(order),
    refunds: refunds.map((refund) => ({
      reference: refund.reference,
      provider: providerOf.get(refund.payment_id)?.split("_")[1] ?? null,
      sent_as: refund.reference.replace(/[^A-Za-z0-9]/g, "").slice(0, 64),
      parts: ((refund.provider_parts as { amount: number; state: string }[] | null) ?? []).map(
        ({ amount, state }) => ({ amount, state })
      ),
      amount: refund.amount,
      status: refund.status,
      incomplete:
        refund.status === "pending" &&
        (UNSETTLED as readonly (string | null)[]).includes(refund.error_code),
      note: refund.note,
      created_by: refund.created_by,
      created_at: new Date(refund.created_at).toISOString(),
    })),
  }
}

function bankTransferState(order: BankTransferOrderRow): BankTransferState | null {
  const transfer = bankTransferOf(order)
  if (!transfer) {
    return null
  }
  return {
    awaiting: transfer.collection.status === "awaiting",
    deadline: transferDeadline(order.created_at, transfer.session)?.toISOString() ?? null,
    confirmed_at: confirmedAt(transfer.session),
  }
}
