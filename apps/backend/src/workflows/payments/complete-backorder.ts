import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  completeCartWorkflow,
  createInventoryLevelsWorkflow,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { ORDER_STOCK_SHORT } from "../../lib/stock"
import type { StockShortLine } from "../../lib/stock"
import { markStockShortStep } from "./steps/backorder"
import { planBackorderStep } from "./steps/backorder-plan"
import { lowerShelfStep, raiseShelfStep, recordBackorderLedgerStep } from "./steps/shelf-raise"

/** One at a time, and the sweeper waits for it: a raise is lowered once. */
export const BACKORDER_LOCK = "payments-complete-backorder"

export interface PaidBackorder {
  order_id: string
  short: StockShortLine[]
}

/**
 * A paid cart the shelf refused, placed anyway (adr/0026 Ek 2026-11-06,
 * security review 2026-11-09): the money is taken, so the order is the
 * shop's to fulfil (make or buy the units) or to cancel and refund.
 * Medusa reserves only what a level has free, so each level is raised by
 * exactly what the cart lacks there (a level the channel lacks opened at
 * 0 first), Medusa's own completion runs, and the levels are lowered by
 * the same amounts: the order's reservation stands above the shelf. Each
 * raise is marked on its level until lowered; one a crash leaves behind is
 * lowered by the sweeper (`jobs/backorder-sweep.ts`). The stock ledger
 * records the raise, the order's reservation and the lowering apart. The
 * order is marked `stock_short` and the shop told (`order.stock_short`).
 */
export const completePaidCartAsBackorderWorkflow = createWorkflow(
  "payments-complete-paid-cart-backorder",
  (input: { cart_id: string }) => {
    acquireLockStep({ key: BACKORDER_LOCK, timeout: 15, ttl: 120 })
    const plan = planBackorderStep(input.cart_id)
    when("payments-backorder-levels", { plan }, ({ plan }) => plan.levels.length > 0).then(() => {
      createInventoryLevelsWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({ inventory_levels: plan.levels })),
      })
    })
    const raised = raiseShelfStep(
      transform({ plan, input }, ({ plan, input }) => ({
        cart_id: input.cart_id,
        raises: plan.raises,
      }))
    )
    const levels = transform({ raised }, ({ raised }) =>
      raised.raised.map(({ inventory_item_id, location_id }) => ({
        inventory_item_id,
        location_id,
      }))
    )
    const reference = transform({ input }, ({ input }) => `backorder:${input.cart_id}`)
    recordBackorderLedgerStep({ levels, reason: "reconcile", reference }).config({
      name: "payments-backorder-ledger-raise",
    })
    const order = completeCartWorkflow.runAsStep({ input: { id: input.cart_id } })
    recordBackorderLedgerStep({
      levels,
      order_id: transform({ order }, ({ order }) => order.id),
    }).config({ name: "payments-backorder-ledger-order" })
    lowerShelfStep(raised)
    recordBackorderLedgerStep({ levels, reason: "reconcile", reference }).config({
      name: "payments-backorder-ledger-lower",
    })
    releaseLockStep({ key: BACKORDER_LOCK })
    const marked = markStockShortStep(
      transform({ order, plan }, ({ order, plan }) => ({ order_id: order.id, short: plan.short }))
    )
    when("payments-backorder-alert", { marked }, ({ marked }) => marked).then(() => {
      emitEventStep({
        eventName: ORDER_STOCK_SHORT,
        data: transform({ order }, ({ order }) => ({ id: order.id })),
      })
    })
    return new WorkflowResponse(
      transform({ order, plan }, ({ order, plan }): PaidBackorder => ({
        order_id: order.id,
        short: plan.short,
      }))
    )
  }
)
