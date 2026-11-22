import type { BigNumberInput, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import {
  BANK_TRANSFER_ORDER_FIELDS,
  bankTransferOf,
  confirmedAt,
  transferDeadline,
} from "../../../lib/payments/bank-transfer"
import type { BankTransferOrderRow } from "../../../lib/payments/bank-transfer"
import { refuseMoneyForCancelledDeparture } from "../../booking/paid-guard"

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

const readOrder = async (
  container: MedusaContainer,
  orderId: string
): Promise<BankTransferOrderRow> => {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: BANK_TRANSFER_ORDER_FIELDS,
    filters: { id: orderId },
  })
  const order = data[0] as BankTransferOrderRow | undefined
  if (!order) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  return order
}

/** The order's bank transfer session; a cancelled order, or one paid another way, is refused. */
export const readBankTransferOrderStep = createStep(
  "payments-read-bank-transfer-order",
  async (orderId: string, { container }) => {
    const order = await readOrder(container, orderId)
    if (order.status === "canceled") {
      throw new ValidationError("bank_transfer.order_canceled")
    }
    const transfer = bankTransferOf(order)
    if (!transfer) {
      throw new ValidationError("bank_transfer.not_this_order")
    }
    const { session } = transfer
    if (!transfer.captured) {
      // A departure cancelled before the money came: nothing to take it for (review O3)
      await refuseMoneyForCancelledDeparture(container, orderId)
    }
    return new StepResponse<BankTransferOrder>(
      transfer.captured
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
 * Writes when the money was confirmed into the session (the one update
 * the provider takes); who confirmed it the audit log keeps. A run that
 * failed after it finds it there and goes on: confirming again never
 * needs undoing.
 */
export const markBankTransferConfirmedStep = createStep(
  "payments-mark-bank-transfer-confirmed",
  async (order: BankTransferOrder, { container }) => {
    if (order.done || typeof order.data["confirmed_at"] === "string") {
      return new StepResponse(null)
    }
    await container.resolve(Modules.PAYMENT).updatePaymentSession({
      id: order.session_id,
      amount: order.amount,
      currency_code: order.currency_code,
      data: { ...order.data, confirmed_at: new Date().toISOString() },
    })
    return new StepResponse(null)
  }
)

/**
 * Whether the order's time to pay ran out, read again under the order's
 * lock (adr/0029): still pending and awaiting, never confirmed, nothing
 * captured, past the deadline the shopper was told.
 */
export const readExpiredBankTransferStep = createStep(
  "payments-read-expired-bank-transfer",
  async (input: { order_id: string; now: string }, { container }) => {
    const order = await readOrder(container, input.order_id)
    const transfer = bankTransferOf(order)
    const deadline = transfer ? transferDeadline(order.created_at, transfer.session) : null
    const expired =
      order.status === "pending" &&
      transfer !== null &&
      transfer.collection.status === "awaiting" &&
      !transfer.captured &&
      confirmedAt(transfer.session) === null &&
      deadline !== null &&
      deadline <= new Date(input.now)
    return new StepResponse({ expired, deadline: deadline?.toISOString() ?? null })
  }
)
