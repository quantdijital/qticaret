import type { IOrderModuleService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { createGiftCardsWorkflow, deleteGiftCardWorkflow } from "@medusajs/loyalty-plugin/workflows"
import { errorSummary, logger } from "../../lib/logging"
import { giftIssueLockKey } from "../../lib/orders/locks"
import { giftCardCode } from "../../lib/promotions"
import { GIFT_CARDS_KEY, giftIssuePlan, last4 } from "../../lib/promotions/gift-sale"
import type { GiftIssuePlan } from "../../lib/promotions/gift-sale"
import { ISSUE_KEY, cardsOfLines, liraOfKurus, orderGifts } from "./order-gifts"

export interface IssueGiftCardsInput {
  order_id: string
}

interface Planned {
  plan: GiftIssuePlan
  currency_code: string
}

/** What the order's gift lines still owe, read under the order's lock. */
const planGiftCardsStep = createStep(
  "gift-cards-plan-issue",
  async (input: IssueGiftCardsInput, { container }) => {
    const gifts = await orderGifts(container, input.order_id)
    const planned: Planned = gifts
      ? { plan: giftIssuePlan(gifts.facts), currency_code: gifts.currency_code }
      : { plan: { state: "none" }, currency_code: "try" }
    return new StepResponse(planned)
  }
)

/**
 * One card per unit still missing, through the loyalty plugin's own
 * workflow (its store credit account made and credited), with our code
 * (80 bits, adr/0025) and no last day. Each card names its order and line
 * and carries its unit's key; the line's cards are counted before, so a
 * run again makes none twice. Undone (or failing halfway), the cards this
 * run made go: none was sent yet.
 */
const createGiftCardsStep = createStep(
  "gift-cards-create",
  async (input: Planned & { order_id: string }, { container }) => {
    if (input.plan.state !== "issue") {
      return new StepResponse({ made: [] as string[] }, [] as string[])
    }
    const made: string[] = []
    try {
      for (const unit of input.plan.units) {
        const { result } = await createGiftCardsWorkflow(container).run({
          input: [
            {
              code: giftCardCode(),
              value: liraOfKurus(unit.value_kurus),
              currency_code: input.currency_code,
              expires_at: null,
              reference: "order",
              reference_id: input.order_id,
              line_item_id: unit.line_id,
              // The recipient's, not the buyer's: a card is spent by its code
              customer_id: null,
              metadata: { [ISSUE_KEY]: unit.key },
            },
          ],
        })
        made.push(...[result].flat().map((card: { id: string }) => card.id))
      }
    } catch (error) {
      await removeCards(container, made)
      throw error
    }
    return new StepResponse({ made }, made)
  },
  async (made, { container }) => {
    await removeCards(container, made ?? [])
  }
)

async function removeCards(
  container: Parameters<typeof deleteGiftCardWorkflow>[0],
  ids: readonly string[]
): Promise<void> {
  for (const id of ids) {
    try {
      await deleteGiftCardWorkflow(container).run({ input: { id } })
    } catch (error) {
      logger.error({ event: "gift_cards.undo_failed", card: id, err: errorSummary(error) })
    }
  }
}

/**
 * Each gift line records its cards (`qt_gift_cards`: id and last four
 * characters, never the code), read back from the plugin. The lines that
 * hold a card per unit are ready for the recipient's e-mail. Undone, the
 * metadata before comes back.
 */
const recordGiftCardsStep = createStep(
  "gift-cards-record",
  async (input: IssueGiftCardsInput, { container }) => {
    const gifts = await orderGifts(container, input.order_id)
    if (!gifts) {
      return new StepResponse({ complete: [] as string[] }, [])
    }
    const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
    const cards = await cardsOfLines(container, [...gifts.metadata.keys()])
    const before: { id: string; metadata: Record<string, unknown> | null }[] = []
    const complete: string[] = []
    for (const line of gifts.facts.lines.filter((each) => each.gift)) {
      const mine = cards.filter((card) => card.line_item_id === line.id)
      const record = mine.map((card) => ({ id: card.id, last4: last4(card.code) }))
      const metadata = gifts.metadata.get(line.id) ?? null
      if (JSON.stringify(metadata?.[GIFT_CARDS_KEY] ?? []) !== JSON.stringify(record)) {
        before.push({ id: line.id, metadata })
        await orders.updateOrderLineItems(line.id, {
          metadata: { ...(metadata ?? {}), [GIFT_CARDS_KEY]: record },
        })
      }
      if (mine.length >= line.quantity && line.quantity > 0) {
        complete.push(line.id)
      }
    }
    return new StepResponse({ complete }, before)
  },
  async (before, { container }) => {
    const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
    for (const line of before ?? []) {
      await orders.updateOrderLineItems(line.id, { metadata: line.metadata ?? {} })
    }
  }
)

/**
 * Issues the cards a paid order's gift lines bought (adr/0025 Ek
 * 2026-11-03), under the order's lock: the order's placing and its
 * payment's capture may both ask at once. Nothing for an unpaid,
 * canceled or test-mode order, nor for one refunded before. What it
 * returns: why it did nothing, or the lines ready for their e-mail.
 */
export const issueGiftCardsWorkflow = createWorkflow(
  "gift-cards-issue",
  (input: IssueGiftCardsInput) => {
    const lockKey = transform({ input }, ({ input }) => giftIssueLockKey(input.order_id))
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 120 })
    const planned = planGiftCardsStep(input)
    const made = createGiftCardsStep(
      transform({ planned, input }, ({ planned, input }) => ({
        ...planned,
        order_id: input.order_id,
      }))
    )
    const recorded = recordGiftCardsStep(input)
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(
      transform({ planned, made, recorded }, ({ planned, made, recorded }) => ({
        state: planned.plan.state,
        issued: made.made.length,
        complete: recorded.complete,
      }))
    )
  }
)
