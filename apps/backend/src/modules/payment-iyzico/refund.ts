import { container } from "@medusajs/framework"
import { ValidationError, isProviderError } from "../../lib/errors"
import { kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { iyzicoApi } from "../../lib/payments/iyzico"
import type { IyzicoCredentials } from "../../lib/payments/iyzico"
import { ORDER_REFUNDS_MODULE } from "../order-refunds"
import type OrderRefundsModuleService from "../order-refunds/service"
import type { ProviderPart } from "../order-refunds/service"
import { iyzicoSession } from "./session"

/** A refund kept in the payment's data: its reference, the kuruş and the parts by transaction. */
interface RefundRecord {
  reference_no: string
  amount: number
  parts: { transaction_id: string; amount: number }[]
}

interface ItemTransaction {
  item_id: string
  transaction_id: string
  paid: number
}

// The whole payment taken back by a cancel, not by item transaction
const CANCEL = "cancel"

// iyzico's answers the shop can act on, as messages; the rest stay provider errors
const SHOP_ACTIONABLE = new Set(["refund_exceeds_line", "refund_not_supported", "refund_same_day"])

const recordsOf = (data: Record<string, unknown> | undefined): RefundRecord[] =>
  Array.isArray(data?.["refunds"]) ? (data["refunds"] as RefundRecord[]) : []

const transactionsOf = (data: Record<string, unknown> | undefined): ItemTransaction[] =>
  Array.isArray(data?.["item_transactions"]) ? (data["item_transactions"] as ItemTransaction[]) : []

/**
 * Splits `amount` over the item transactions by what each has left,
 * products first (the shipping line last), as few parts as it takes.
 */
export function allocateRefund(
  transactions: readonly ItemTransaction[],
  refunded: ReadonlyMap<string, number>,
  amount: number
): { transaction_id: string; amount: number }[] {
  const ordered = [...transactions].sort(
    (a, b) => Number(!a.item_id.startsWith("cali_")) - Number(!b.item_id.startsWith("cali_"))
  )
  const parts: { transaction_id: string; amount: number }[] = []
  let left = amount
  for (const transaction of ordered) {
    const room = transaction.paid - (refunded.get(transaction.transaction_id) ?? 0)
    const part = Math.min(room, left)
    if (part > 0) {
      parts.push({ transaction_id: transaction.transaction_id, amount: part })
      left -= part
    }
  }
  if (left > 0) {
    throw new ValidationError("orders.refund_exceeds_paid", { field: "amount" })
  }
  return parts
}

/** The ledger entry of the refund under way (`order-refunds`), as the provider keeps its parts. */
async function ledgerParts(reference: string): Promise<{
  parts: ProviderPart[]
  save: (parts: ProviderPart[]) => Promise<void>
}> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const parts = await ledger.providerParts(reference)
  // Only our order refund names one: Medusa's own refunds of an iyzico payment are not made
  if (!parts) {
    throw new ValidationError("payments.use_order_refund")
  }
  return { parts, save: (next) => ledger.saveProviderParts(reference, next) }
}

/**
 * Gives back `amount` of an iyzico payment under `reference` (F5 V10).
 * iyzico refunds by item transaction and keeps no record we can read, so
 * each part is written to the refund's ledger entry before it is sent: a
 * part whose answer was lost is never sent again (the shop checks iyzico's
 * panel). A whole payment refused a refund the same day is cancelled
 * instead. Returns the payment's data with the refund recorded.
 */
export async function refundIyzicoPayment(
  account: IyzicoCredentials,
  data: Record<string, unknown> | undefined,
  amount: Kurus,
  reference: string
): Promise<Record<string, unknown>> {
  const session = iyzicoSession(data)
  if (account.testMode !== session.test_mode) {
    throw new ValidationError("iyzico.test_mode_mismatch")
  }
  const records = recordsOf(data)
  if (records.some((record) => record.reference_no === reference)) {
    return { ...data }
  }
  const paymentId = data?.["payment_id"]
  if (typeof paymentId !== "string") {
    throw new ValidationError("payments.session_invalid")
  }
  const ledger = await ledgerParts(reference)
  const parts = [...ledger.parts]
  if (parts.some((part) => part.state === "sending")) {
    throw new ValidationError("iyzico.refund_outcome_unknown")
  }
  const refunded = new Map<string, number>()
  for (const part of [...records.flatMap((record) => record.parts), ...parts]) {
    refunded.set(part.transaction_id, (refunded.get(part.transaction_id) ?? 0) + part.amount)
  }
  const done = parts.reduce((sum, part) => sum + part.amount, 0)
  const send = async (
    part: { transaction_id: string; amount: number },
    call: () => Promise<unknown>
  ) => {
    parts.push({ ...part, state: "sending" })
    await ledger.save(parts)
    try {
      await call()
    } catch (error) {
      if (isProviderError(error) && error.providerCode === "outcome_unknown") {
        throw new ValidationError("iyzico.refund_outcome_unknown", { cause: error })
      }
      // Refused: nothing was given back, the part is not kept
      parts.pop()
      await ledger.save(parts)
      throw error
    }
    parts[parts.length - 1] = { ...part, state: "done" }
    await ledger.save(parts)
  }
  try {
    for (const part of allocateRefund(transactionsOf(data), refunded, amount - done)) {
      await send(part, () =>
        iyzicoApi().refundTransaction(account, {
          transactionId: part.transaction_id,
          amount: kurus(part.amount),
          conversationId: reference,
        })
      )
    }
  } catch (error) {
    const whole = amount === session.amount && records.length === 0 && parts.length === 0
    if (whole && isProviderError(error) && error.providerCode === "refund_same_day") {
      await send({ transaction_id: CANCEL, amount }, () =>
        iyzicoApi().cancelPayment(account, { paymentId, conversationId: reference })
      )
    } else if (isProviderError(error) && SHOP_ACTIONABLE.has(error.providerCode)) {
      throw new ValidationError(`iyzico.${error.providerCode}`, { cause: error })
    } else {
      throw error
    }
  }
  return {
    ...data,
    refunds: [
      ...records,
      {
        reference_no: reference,
        amount,
        parts: parts.map(({ transaction_id, amount: part }) => ({ transaction_id, amount: part })),
      },
    ],
  }
}
