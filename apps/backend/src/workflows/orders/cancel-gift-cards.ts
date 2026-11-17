import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { debitAccountsWorkflow } from "@medusajs/loyalty-plugin/workflows"
import { ConflictError } from "../../lib/errors"
import {
  GIFT_CANCEL_REFERENCE,
  cardsVoidedByCancel,
  voidingDebits,
} from "../../lib/orders/gift-returns"
import type { CardDebit } from "../../lib/orders/gift-returns"
import { giftIssueLockKey, returnsLockKey } from "../../lib/orders/locks"
import { giftLinesOf } from "../returns/gift-lines"
import { closeWaitingRequestsStep } from "../returns/steps/cancel"
import { refundForCancel } from "./cancel-refunds"
import type { CancelRefundInput } from "./cancel-refunds"
import { clearPendingRefundsStep } from "./steps/pending-refund"

export interface CancelGiftCardsInput {
  order_id: string
  /** Who cancels, and the note the cancel's refunds carry (`refundForCancel`). */
  refund: Omit<CancelRefundInput, "order_id">
}

/**
 * The order's gift cards a cancel voids, read under its returns and issue
 * locks: every untouched card its gift lines issued, its whole balance
 * debited under the order (`order_cancel`). None before a card was issued,
 * nor for an order without gift lines. A card spent or closed by staff
 * refuses the cancel (`orders.gift_card_used`). Reads only.
 */
const planCancelVoidStep = createStep(
  "orders-plan-cancel-gift-void",
  async (input: { order_id: string }, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["items.id", "items.product_id", "items.metadata"],
      filters: { id: input.order_id },
    })
    const items = (data[0] as { items?: ({ id: string } | null)[] | null } | undefined)?.items ?? []
    const gifts = await giftLinesOf(container, items)
    const cards = cardsVoidedByCancel(gifts.values())
    if (!cards || cards.some((card) => !card.account_id)) {
      throw new ConflictError("orders.gift_card_used")
    }
    return new StepResponse<CardDebit[]>(
      voidingDebits(cards, {
        reference: GIFT_CANCEL_REFERENCE,
        reference_id: input.order_id,
        note: `order ${input.order_id} canceled`,
      })
    )
  }
)

/**
 * The cancel's money back, once its cards are void (`refundForCancel`):
 * refunds still open settled first, then one per payment, each under the
 * payment's own reference (tried again, made once). Money given back is
 * not taken again, so nothing to undo here; a refund that fails undoes the
 * void before it, and the cards are the recipient's again.
 */
const cancelRefundsStep = createStep(
  "orders-cancel-refunds",
  async (input: CancelRefundInput, { container }) =>
    new StepResponse(await refundForCancel(container, input))
)

/**
 * What a cancel does before Medusa's own cancel (adr/0025, 2026-11-03): an
 * order whose gift cards went out is cancelled only while every card is
 * untouched. Those cards are voided as a withdrawal voids them (the
 * loyalty plugin's `debitAccountsWorkflow`, undone by deleting its debits),
 * then the money goes back. A return request still waiting for the
 * shop's decision (a gift line's withdrawal, asked before shipping) is
 * closed as cancelled by the order's cancel; a refund that fails opens it
 * again. Under the order's returns lock, so a
 * withdrawal and a cancel never void at once, and its gift card issue
 * lock, so no card is issued meanwhile: once the refund is written the
 * issue finds the order refunded and makes none. The shopper's cancel and
 * staff's (`/admin/orders/:id/cancel`) both run it, under the order's
 * cancel locks.
 */
export const cancelGiftCardsWorkflow = createWorkflow(
  "orders-cancel-gift-cards",
  (input: CancelGiftCardsInput) => {
    const lockKeys = transform({ input }, ({ input }) => [
      returnsLockKey(input.order_id),
      giftIssueLockKey(input.order_id),
    ])
    // A provider refunding in parts makes several calls in a row: the lock outlasts them
    acquireLockStep({ key: lockKeys, timeout: 10, ttl: 600 })
    const debits = planCancelVoidStep(
      transform({ input }, ({ input }) => ({ order_id: input.order_id }))
    )
    // A gift line's withdrawal still waiting has nothing left to withdraw once the cancel voids
    closeWaitingRequestsStep(transform({ input }, ({ input }) => ({ order_id: input.order_id })))
    when("orders-cancel-void-gift-cards", { debits }, ({ debits }) => debits.length > 0).then(
      () => {
        debitAccountsWorkflow.runAsStep({ input: debits })
      }
    )
    cancelRefundsStep(
      transform({ input }, ({ input }) => ({ order_id: input.order_id, ...input.refund }))
    )
    // Before Medusa's own cancel refunds anything left: no payment names one of ours (review D1)
    clearPendingRefundsStep(transform({ input }, ({ input }) => ({ order_id: input.order_id })))
    releaseLockStep({ key: lockKeys })
    return new WorkflowResponse(transform({ debits }, ({ debits }) => ({ voided: debits.length })))
  }
)
