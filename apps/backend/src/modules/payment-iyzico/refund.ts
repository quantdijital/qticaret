import { container } from "@medusajs/framework"
import { ValidationError, isProviderError } from "../../lib/errors"
import { kurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { iyzicoApi, nothingDone } from "../../lib/payments/iyzico"
import type { IyzicoCredentials } from "../../lib/payments/iyzico"
import { withRefundRecord } from "../../lib/payments/pending-refund"
import { ORDER_REFUNDS_MODULE } from "../order-refunds"
import type OrderRefundsModuleService from "../order-refunds/service"
import type { ProviderPart } from "../order-refunds/service"
import { iyzicoSession } from "./session"

interface ItemTransaction {
  item_id: string
  transaction_id: string
  paid: number
}

type Part = Pick<ProviderPart, "transaction_id" | "amount">

// The whole payment taken back by a cancel, not by item transaction
const CANCEL = "cancel"

// iyzico's refusals the shop can act on, as messages; the rest stay provider errors
const SHOP_ACTIONABLE = new Set(["refund_exceeds_line", "refund_not_supported", "refund_same_day"])

const transactionsOf = (data: Record<string, unknown> | undefined): ItemTransaction[] =>
  Array.isArray(data?.["item_transactions"]) ? (data["item_transactions"] as ItemTransaction[]) : []

const unknown = (cause?: unknown) => new ValidationError("iyzico.refund_outcome_unknown", { cause })

/**
 * Splits `amount` over the item transactions by what each has left,
 * products first (the shipping line last), as few parts as it takes.
 */
export function allocateRefund(
  transactions: readonly ItemTransaction[],
  sent: readonly Part[],
  amount: number
): Part[] {
  const refunded = new Map<string, number>()
  for (const part of sent) {
    refunded.set(part.transaction_id, (refunded.get(part.transaction_id) ?? 0) + part.amount)
  }
  const ordered = [...transactions].sort(
    (a, b) => Number(!a.item_id.startsWith("cali_")) - Number(!b.item_id.startsWith("cali_"))
  )
  const parts: Part[] = []
  let left = amount
  for (const transaction of ordered) {
    const part = Math.min(transaction.paid - (refunded.get(transaction.transaction_id) ?? 0), left)
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

/**
 * The refund's ledger entry (`order-refunds`, named by our order refund in
 * `pending_refund`), and every part sent for the same payment under any
 * reference: iyzico keeps no record we can read, this is the only one.
 */
async function ledgerOf(reference: string) {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const entry = await ledger.providerParts(reference)
  if (!entry) {
    throw new ValidationError("payments.use_order_refund")
  }
  const parts = [...entry.parts]
  return {
    parts,
    sent: await ledger.paymentParts(entry.payment_id),
    save: () => ledger.saveProviderParts(reference, parts),
  }
}

/**
 * Sends one part, written `sending` first and `done` once iyzico's signed
 * answer is for exactly it. Only a part iyzico surely did not make is
 * taken off again; any other failure leaves it `sending`: never sent again.
 */
async function sendPart(
  ledger: Awaited<ReturnType<typeof ledgerOf>>,
  part: Part,
  call: () => Promise<boolean>
): Promise<void> {
  ledger.parts.push({ ...part, state: "sending" })
  await ledger.save()
  let matches: boolean
  try {
    matches = await call()
  } catch (error) {
    if (!nothingDone(error)) {
      throw unknown(error)
    }
    ledger.parts.pop()
    await ledger.save()
    if (isProviderError(error) && SHOP_ACTIONABLE.has(error.providerCode)) {
      throw new ValidationError(`iyzico.${error.providerCode}`, { cause: error })
    }
    throw error
  }
  if (!matches) {
    throw unknown()
  }
  ledger.parts[ledger.parts.length - 1] = { ...part, state: "done" }
  await ledger.save()
}

/**
 * Gives back `amount` of an iyzico payment under `reference` (F5 V10,
 * security review 2026-10-27). Each part is allocated against every part
 * ever sent for the payment, and a part whose outcome is unknown stops all
 * refunds of it until the shop checked iyzico's panel. A whole payment
 * iyzico will not refund on its day is cancelled instead.
 */
export async function refundIyzicoPayment(
  account: IyzicoCredentials,
  data: Record<string, unknown> | undefined,
  amount: Kurus,
  reference: string,
  refundId?: string
): Promise<Record<string, unknown>> {
  const session = iyzicoSession(data)
  const paymentId = data?.["payment_id"]
  if (account.testMode !== session.test_mode) {
    throw new ValidationError("iyzico.test_mode_mismatch")
  }
  if (typeof paymentId !== "string") {
    throw new ValidationError("payments.session_invalid")
  }
  const ledger = await ledgerOf(reference)
  if (ledger.sent.some((part) => part.state === "sending")) {
    throw unknown()
  }
  const currency = session.currency_code.toUpperCase()
  const done = ledger.parts.reduce((sum, part) => sum + part.amount, 0)
  const refund = (part: Part) => async () => {
    const answer = await iyzicoApi().refundTransaction(account, {
      transactionId: part.transaction_id,
      amount: kurus(part.amount),
      currency,
      conversationId: reference,
    })
    return (
      answer.paymentId === paymentId &&
      answer.amount === part.amount &&
      answer.currency.toUpperCase() === currency &&
      answer.conversationId === reference
    )
  }
  try {
    for (const part of allocateRefund(transactionsOf(data), ledger.sent, amount - done)) {
      await sendPart(ledger, part, refund(part))
    }
  } catch (error) {
    const whole = amount === session.amount && ledger.sent.length === 0 && ledger.parts.length === 0
    const sameDay = (error as { safeMessage?: string }).safeMessage === "iyzico.refund_same_day"
    if (!whole || !sameDay) {
      throw error
    }
    await sendPart(ledger, { transaction_id: CANCEL, amount }, async () => {
      const answer = await iyzicoApi().cancelPayment(account, {
        paymentId,
        conversationId: reference,
      })
      return answer.amount >= amount
    })
  }
  // Recorded for our ledger: a step failing after this finds the refund made (`refundRecorded`)
  return withRefundRecord(data, reference, amount, refundId)
}
