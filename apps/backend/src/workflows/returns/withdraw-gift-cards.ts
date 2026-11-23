import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { debitAccountsWorkflow } from "@medusajs/loyalty-plugin/workflows"
import { ValidationError } from "../../lib/errors"
import {
  GIFT_WITHDRAWAL_REFERENCE,
  cardsToVoid,
  voidingDebits,
} from "../../lib/orders/gift-returns"
import type { CardDebit } from "../../lib/orders/gift-returns"
import { returnsLockKey } from "../../lib/orders/locks"
import { giftLinesOf } from "./gift-lines"
import {
  readReturnRequestStep,
  returnRequestOrderStep,
  updateReturnRequestStep,
} from "./steps/return-request"
import type { RequestFacts } from "./steps/return-request"
import { acquireLocksStep } from "../locking/acquire-locks"
import { releaseLocksStep } from "../locking/release-locks"

/**
 * The cards the request withdraws, read under the order's returns lock:
 * every asked line a gift card line, as money back, and as many untouched
 * cards per line as units asked; a card spent since the request refuses it
 * (`returns.gift_card_used`). Each card's whole balance is what its void
 * debits. Reads only: nothing to undo.
 */
const planGiftWithdrawalStep = createStep(
  "returns-plan-gift-withdrawal",
  async (request: RequestFacts, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: ["items.id", "items.product_id", "items.metadata"],
      filters: { id: request.order_id },
    })
    const items = (data[0] as { items?: ({ id: string } | null)[] | null } | undefined)?.items ?? []
    const gifts = await giftLinesOf(container, items)
    if (
      request.kind !== "return" ||
      request.items.length === 0 ||
      !request.items.every((line) => gifts.has(line.line_item_id))
    ) {
      throw new ValidationError("returns.gift_card_separate", { field: "items" })
    }
    const cards = cardsToVoid(request.items, gifts)
    if (!cards || cards.some((card) => !card.account_id)) {
      throw new ValidationError("returns.gift_card_used", { field: "items" })
    }
    return new StepResponse<CardDebit[]>(
      voidingDebits(cards, {
        reference: GIFT_WITHDRAWAL_REFERENCE,
        reference_id: request.id,
        note: `return ${request.id}`,
      })
    )
  }
)

/**
 * The shop accepts a withdrawal from gift cards (adr/0025, the owner
 * 2026-11-03; TASLAK, avukat onayı bekler): nothing is sent back, so no
 * Medusa return or carrier is opened (a card is never fulfilled). Under
 * the order's returns lock, the asked cards are voided the way the panel
 * closes a card (their whole balance debited through the loyalty plugin,
 * the request named on each debit, undone by deleting those debits) and
 * the request goes straight to received, what it asked counted as what
 * came back, for its refund (`refundReturn`) to give the money back. A
 * step that fails undoes the ones before it.
 */
export const withdrawGiftCardsWorkflow = createWorkflow(
  "returns-withdraw-gift-cards",
  (input: { id: string; staff_id: string; note?: string | null }) => {
    const orderId = returnRequestOrderStep({ id: input.id })
    const lockKey = transform({ orderId }, ({ orderId }) => returnsLockKey(orderId))
    const held = acquireLocksStep({ key: lockKey, timeout: 10, ttl: 120 })
    const request = readReturnRequestStep({ id: input.id, status: "requested" })
    const debits = planGiftWithdrawalStep(request)
    debitAccountsWorkflow.runAsStep({ input: debits })
    const received = updateReturnRequestStep(
      transform({ input, request }, ({ input, request }) => {
        const now = new Date()
        return {
          id: input.id,
          from: "requested" as const,
          changes: {
            status: "received",
            decided_by: input.staff_id,
            decided_at: now,
            decision_note: input.note ?? null,
            received_items: request.items,
            damaged_items: [],
            refund_shipping: false,
            received_at: now,
          },
        }
      })
    )
    releaseLocksStep(held)
    return new WorkflowResponse(received)
  }
)
