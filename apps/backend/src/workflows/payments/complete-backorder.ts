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
import {
  allowBackorderStep,
  markStockShortStep,
  planBackorderStep,
  restoreBackorderStep,
} from "./steps/backorder"

// One at a time: the variants sell past the shelf only while their own order is placed
const BACKORDER_LOCK = "payments-complete-backorder"

export interface PaidBackorder {
  order_id: string
  short: StockShortLine[]
}

/**
 * A paid cart the shelf refused, placed anyway (adr/0026 Ek 2026-11-06):
 * the money is taken, so the order is the shop's to fulfil (make or buy
 * the units) or to cancel and refund. Medusa's own completion runs with
 * the cart's tracked variants allowing backorder for its length, so its
 * reservations are made past the shelf; levels a warehouse lacks are
 * opened at 0 first. Everything before the order undoes itself if the
 * completion fails. The order is marked `stock_short` and the shop told
 * (`order.stock_short`).
 */
export const completePaidCartAsBackorderWorkflow = createWorkflow(
  "payments-complete-paid-cart-backorder",
  (input: { cart_id: string }) => {
    acquireLockStep({ key: BACKORDER_LOCK, timeout: 15, ttl: 60 })
    const plan = planBackorderStep(input.cart_id)
    when("payments-backorder-levels", { plan }, ({ plan }) => plan.levels.length > 0).then(() => {
      createInventoryLevelsWorkflow.runAsStep({
        input: transform({ plan }, ({ plan }) => ({ inventory_levels: plan.levels })),
      })
    })
    const allowed = allowBackorderStep(transform({ plan }, ({ plan }) => plan.variant_ids))
    const order = completeCartWorkflow.runAsStep({ input: { id: input.cart_id } })
    restoreBackorderStep(allowed)
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
