import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { ConflictError, ValidationError } from "../../lib/errors"
import { logger } from "../../lib/logging"
import { orderRefundLockKey } from "../../lib/orders/locks"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import type { ProviderPart } from "../../modules/order-refunds/service"
import { keepMadePart, madeInPart } from "./made-in-part"
import { assertRecordable, recordMadeRefund } from "./made-refund-record"
import { tracedOf } from "./refund-settle"
import type { LedgerEntry } from "./refund-settle"
import { refundTraceOf } from "./refund-trace"
import { dropPendingRefund } from "./steps/pending-refund"
import { restoreRefundTransaction } from "./steps/refund-transactions"

export interface SettleRefundByHandInput {
  order_id: string
  reference: string
  /**
   * What the shop saw at the provider: the money went back, or it did not;
   * or, for an iyzico refund made in part (D4-1), that the parts iyzico
   * answered are what was made and the rest was not.
   */
  outcome: "made" | "not_made" | "made_in_part"
  actor_id: string
}

/** Checked at the provider by staff: the codes say so in the ledger (the audit log says who). */
export const CHECKED_MADE = "checked_made"
export const CHECKED_NOT_MADE = "checked_not_made"
export const CHECKED_MADE_IN_PART = "checked_made_in_part"

/** A provider's parts (iyzico), as the ledger keeps them: kuruş, and whether its answer came. */
const partsOf = (entry: { provider_parts?: unknown }): ProviderPart[] =>
  (entry.provider_parts as ProviderPart[] | null) ?? []

const total = (parts: readonly ProviderPart[]) => parts.reduce((sum, part) => sum + part.amount, 0)

/**
 * Whether staff may say what became of the refund (review 2026-11-17,
 * third round O-2, D-1): "not made" never for money shown back (recorded,
 * shown by the provider) nor for a refund a part of which iyzico answered;
 * "made" only for the whole amount (the answered parts and the ones whose
 * answer was lost together). A refund made in part is neither: it is
 * closed as made in part (`settleMadeInPart`, D4-1), its rest refunded anew.
 */
async function assertSettleable(
  container: Pick<MedusaContainer, "resolve">,
  entry: LedgerEntry,
  outcome: "made" | "not_made"
): Promise<void> {
  const parts = partsOf(entry)
  if (outcome === "made") {
    if (parts.length > 0 && total(parts) !== entry.amount) {
      throw new ConflictError("orders.refund_check_partial")
    }
    return
  }
  if (parts.some((part) => part.state === "done")) {
    throw new ConflictError("orders.refund_check_partial")
  }
  const { trace } = await refundTraceOf(container, tracedOf(entry))
  if (trace === "made" || trace === "shown") {
    throw new ConflictError("orders.refund_check_shown")
  }
}

/**
 * A refund left open, checked by staff at the provider (review 2026-11-17,
 * O2): "made" closes it as done, with Medusa's refund record and the
 * order's money move written if missing, and its iyzico parts whose answer
 * was lost marked done; "not made" fails it, its lines free again, those
 * parts taken off (none of them was answered); "made in part" closes an
 * iyzico refund at what its answered parts gave back. Sends nothing. Only
 * an open refund of this order; under the order's refund lock (the
 * workflow's), the entry read inside it.
 */
export async function settleRefundByHand(
  container: Pick<MedusaContainer, "resolve">,
  input: SettleRefundByHandInput
): Promise<{ reference: string; status: "done" | "failed" }> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const [entry] = await ledger.listOrderRefunds(
    { reference: input.reference },
    {
      select: [
        "id",
        "order_id",
        "reference",
        "payment_id",
        "amount",
        "status",
        "lines",
        "provider_parts",
      ],
      take: 1,
    }
  )
  if (entry?.order_id !== input.order_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.refund_unknown")
  }
  if (entry.status !== "pending") {
    throw new ValidationError("orders.refund_not_open")
  }
  if (input.outcome === "made_in_part") {
    return settleMadeInPart(container, entry, input.actor_id)
  }
  await assertSettleable(container, entry, input.outcome)
  const made = input.outcome === "made"
  // The parts first (review O4-1): cut short after this, the refund reads `shown` (every part
  // answered, the whole amount) and the settling job closes it; never a lost part left behind
  const parts = partsOf(entry)
  if (parts.some((part) => part.state === "sending")) {
    await ledger.saveProviderParts(
      entry.reference,
      made ? parts.map((part) => ({ ...part, state: "done" as const })) : []
    )
  }
  if (made) {
    await recordMadeRefund(container, entry, input.actor_id)
    await restoreRefundTransaction(container, entry)
  }
  // The name off before the entry is closed (D4-4): a closed refund never leaves one standing
  await dropPendingRefund(container, entry.payment_id)
  const status = made ? "done" : "failed"
  await ledger.updateOrderRefunds({
    id: entry.id,
    status,
    error_code: made ? CHECKED_MADE : CHECKED_NOT_MADE,
  })
  logger.info({
    event: "orders.refund_checked",
    orderId: entry.order_id,
    reference: entry.reference,
    outcome: input.outcome,
  })
  return { reference: entry.reference, status }
}

/**
 * An iyzico refund made in part, closed by staff as made in part (D4-1):
 * Medusa's refund record and the order's money move for exactly the parts
 * iyzico answered `done` (read from the ledger, never from the request),
 * the entry closed at that amount, its lines spread to match; the rest is
 * refunded anew under a new reference. Any part without an answer is
 * refused: it may have been made. Sends nothing. In this order: the entry
 * rewritten (cut short, it reads `shown` and the job closes it), Medusa's
 * record (`recordMadeRefund`: one, by its note), the money move, the name
 * off the payment, the entry closed.
 */
async function settleMadeInPart(
  container: Pick<MedusaContainer, "resolve">,
  entry: LedgerEntry & { lines?: unknown },
  actorId: string
): Promise<{ reference: string; status: "done" }> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const { done, remainder } = madeInPart(entry.amount, partsOf(entry))
  // Past what the payment can give back: refused before the entry is touched
  await assertRecordable(container, entry.payment_id, done)
  await keepMadePart(container, entry, done)
  const made = { ...entry, amount: done }
  await recordMadeRefund(container, made, actorId)
  await restoreRefundTransaction(container, made)
  await dropPendingRefund(container, entry.payment_id)
  await ledger.updateOrderRefunds({
    id: entry.id,
    status: "done",
    error_code: CHECKED_MADE_IN_PART,
  })
  logger.info({
    event: "orders.refund_checked",
    orderId: entry.order_id,
    reference: entry.reference,
    outcome: "made_in_part",
    done,
    remainder,
  })
  return { reference: entry.reference, status: "done" }
}

export const settleRefundByHandStep = createStep(
  "orders-settle-refund-by-hand",
  async (input: SettleRefundByHandInput, { container }) =>
    new StepResponse(await settleRefundByHand(container, input))
)

export const settleRefundByHandWorkflow = createWorkflow(
  "orders-settle-refund-by-hand",
  (input: SettleRefundByHandInput) => {
    const lockKey = transform({ input }, ({ input }) => orderRefundLockKey(input.order_id))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })
    const settled = settleRefundByHandStep(input)
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(settled)
  }
)
