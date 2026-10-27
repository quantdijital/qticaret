import type { BigNumberInput } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "../../../lib/payments/checkout"

/** An order's bank transfer, as the confirmation needs it; `done` when the money is already in. */
export type BankTransferOrder =
  | { done: true }
  | {
      done: false
      session_id: string
      data: Record<string, unknown>
      amount: BigNumberInput
      currency_code: string
    }

interface OrderRow {
  status: string
  payment_collections?:
    | ({
        payment_sessions?:
          | ({
              id: string
              provider_id: string
              amount: BigNumberInput
              currency_code: string
              data?: Record<string, unknown> | null
            } | null)[]
          | null
        payments?: ({ captured_at?: string | Date | null; canceled_at?: unknown } | null)[] | null
      } | null)[]
    | null
}

/** The order's bank transfer session; a cancelled order, or one paid another way, is refused. */
export const readBankTransferOrderStep = createStep(
  "payments-read-bank-transfer-order",
  async (orderId: string, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "status",
        "payment_collections.payment_sessions.id",
        "payment_collections.payment_sessions.provider_id",
        "payment_collections.payment_sessions.amount",
        "payment_collections.payment_sessions.currency_code",
        "payment_collections.payment_sessions.data",
        "payment_collections.payments.captured_at",
        "payment_collections.payments.canceled_at",
      ],
      filters: { id: orderId },
    })
    const order = data[0] as OrderRow | undefined
    if (!order) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
    }
    if (order.status === "canceled") {
      throw new ValidationError("bank_transfer.order_canceled")
    }
    const collections = (order.payment_collections ?? []).filter((each) => each !== null)
    const session = collections
      .flatMap((collection) => collection.payment_sessions ?? [])
      .find((each) => each?.provider_id === BANK_TRANSFER_PAYMENT_PROVIDER_ID)
    if (!session) {
      throw new ValidationError("bank_transfer.not_this_order")
    }
    const captured = collections
      .flatMap((collection) => collection.payments ?? [])
      .some((payment) => payment?.captured_at && !payment.canceled_at)
    return new StepResponse<BankTransferOrder>(
      captured
        ? { done: true }
        : {
            done: false,
            session_id: session.id,
            data: session.data ?? {},
            amount: session.amount,
            currency_code: session.currency_code,
          }
    )
  }
)

/**
 * Writes who confirmed the money, and when, into the session (the one
 * update the provider takes). A run that failed after it finds it there
 * and goes on: confirming again never needs undoing.
 */
export const markBankTransferConfirmedStep = createStep(
  "payments-mark-bank-transfer-confirmed",
  async (input: { order: BankTransferOrder; confirmed_by: string }, { container }) => {
    const { order } = input
    if (order.done || typeof order.data["confirmed_at"] === "string") {
      return new StepResponse(null)
    }
    await container.resolve(Modules.PAYMENT).updatePaymentSession({
      id: order.session_id,
      amount: order.amount,
      currency_code: order.currency_code,
      data: {
        ...order.data,
        confirmed_at: new Date().toISOString(),
        confirmed_by: input.confirmed_by,
      },
    })
    return new StepResponse(null)
  }
)
