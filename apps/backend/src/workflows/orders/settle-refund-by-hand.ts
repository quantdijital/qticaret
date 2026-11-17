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
import { isFlowOwnedRefund, orderRefundLockKey } from "../../lib/orders/locks"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import type { ProviderPart } from "../../modules/order-refunds/service"
import { CHECKED_MADE_IN_PART, resolveLostPart, settleMadeInPart } from "./made-in-part"
import { recordMadeRefund } from "./made-refund-record"
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
  outcome?: "made" | "not_made" | "made_in_part" | undefined
  /**
   * For a refund with an iyzico part whose answer was lost, and only then
   * (review D4-1, M2): whether iyzico's panel shows that part given back.
   * The server works out the rest from its ledger.
   */
  lost_part?: "made" | "not_made" | undefined
  actor_id: string
}

export interface SettledByHand {
  reference: string
  /** `pending`: a flow's refund made in part, its lost part answered, left to its flow (M1). */
  status: "done" | "failed" | "pending"
  /** Kuruş of a flow's refund staff gave back by hand, outside iyzico (SF1). */
  rest_by_hand?: number
}

/** Checked at the provider by staff: the codes say so in the ledger (the audit log says who). */
export const CHECKED_MADE = "checked_made"
export const CHECKED_NOT_MADE = "checked_not_made"
export { CHECKED_MADE_IN_PART }

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
 * closed as made in part (`settleMadeInPart`, D4-1), its rest refunded anew;
 * a cancel's or a return's, whose rest iyzico keeps refusing, is "made"
 * once staff gave that rest back by hand (review D4-1, SF1): the whole
 * amount recorded, nothing sent.
 */
async function assertSettleable(
  container: Pick<MedusaContainer, "resolve">,
  entry: LedgerEntry,
  outcome: "made" | "not_made"
): Promise<void> {
  const parts = partsOf(entry)
  if (outcome === "made") {
    const given = total(parts)
    const restByHand = isFlowOwnedRefund(entry.reference) && given < entry.amount
    if (parts.length > 0 && given !== entry.amount && !restByHand) {
      throw new ConflictError("orders.refund_check_partial")
    }
    return
  }
  if (parts.some((part) => part.state === "done")) {
    throw new ConflictError("orders.refund_check_partial")
  }
  await assertNotShown(container, entry)
}

/** "Not made" never for money shown back: recorded, or shown by the provider (D-1). */
async function assertNotShown(
  container: Pick<MedusaContainer, "resolve">,
  entry: LedgerEntry
): Promise<void> {
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
): Promise<SettledByHand> {
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
  const parts = partsOf(entry)
  // A part whose answer was lost is answered for first, and only then (M2)
  const lost = parts.some((part) => part.state === "sending")
  if (lost !== (input.lost_part !== undefined)) {
    throw new ConflictError(
      lost ? "orders.refund_lost_part_required" : "orders.refund_lost_part_none"
    )
  }
  if (input.lost_part) {
    return settleLostPart(container, entry, input.lost_part, input.actor_id)
  }
  if (input.outcome === "made_in_part") {
    return settleMadeInPart(container, entry, parts, input.actor_id)
  }
  if (!input.outcome) {
    throw new ValidationError("orders.refund_settle_mode")
  }
  await assertSettleable(container, entry, input.outcome)
  return settleWhole(container, entry, input.outcome === "made", parts, input.actor_id)
}

/**
 * The refund closed whole: made (Medusa's record and the money move
 * written if missing) or not (failed, its lines free again). The parts
 * first (review O4-1): cut short after this, a made refund reads `shown`
 * and the settling job closes it; never a lost part left behind.
 */
async function settleWhole(
  container: Pick<MedusaContainer, "resolve">,
  entry: LedgerEntry,
  made: boolean,
  parts: readonly ProviderPart[],
  actorId: string,
  lostPart?: "made" | "not_made"
): Promise<SettledByHand> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const next = made ? parts : []
  if (JSON.stringify(next) !== JSON.stringify(partsOf(entry))) {
    await ledger.saveProviderParts(entry.reference, [...next])
  }
  if (made) {
    await recordMadeRefund(container, entry, actorId)
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
  // A flow's rest given back by hand, outside iyzico (SF1): said so in the log and the audit
  const byHand = made && parts.length > 0 ? entry.amount - total(parts) : 0
  logger.info({
    event: "orders.refund_checked",
    orderId: entry.order_id,
    reference: entry.reference,
    outcome: made ? "made" : "not_made",
    ...(lostPart ? { lostPart } : {}),
    ...(byHand > 0 ? { restByHand: byHand } : {}),
  })
  return { reference: entry.reference, status, ...(byHand > 0 ? { rest_by_hand: byHand } : {}) }
}

/**
 * A refund with a part whose answer was lost, staff having looked it up in
 * iyzico's panel (review D4-1, M2): that part done or taken off, then what
 * the ledger's parts add up to decides. The whole amount: made. Nothing:
 * not made (never for money shown back). Part of it: a panel or an edit
 * refund closes at that part (MF1); a cancel's or a return's keeps its
 * answered parts open for its flow, which sends what is left (M1).
 */
async function settleLostPart(
  container: Pick<MedusaContainer, "resolve">,
  entry: LedgerEntry & { lines?: unknown },
  answer: "made" | "not_made",
  actorId: string
): Promise<SettledByHand> {
  const parts = resolveLostPart(partsOf(entry), answer)
  const done = total(parts)
  if (done > entry.amount) {
    throw new ConflictError("orders.refund_check_not_partial")
  }
  if (done === entry.amount) {
    return settleWhole(container, entry, true, parts, actorId, answer)
  }
  if (done === 0) {
    await assertNotShown(container, entry)
    return settleWhole(container, entry, false, parts, actorId, answer)
  }
  if (!isFlowOwnedRefund(entry.reference)) {
    return settleMadeInPart(container, entry, parts, actorId, answer)
  }
  await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .saveProviderParts(entry.reference, parts)
  logger.info({
    event: "orders.refund_checked",
    orderId: entry.order_id,
    reference: entry.reference,
    outcome: "left_to_flow",
    lostPart: answer,
    done,
  })
  return { reference: entry.reference, status: "pending" }
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
    // The refund workflow's TTL (review D4-1, L3): never let go while its records are written
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 600 })
    const settled = settleRefundByHandStep(input)
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(settled)
  }
)
