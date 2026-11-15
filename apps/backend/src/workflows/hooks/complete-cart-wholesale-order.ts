import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { completeCartWorkflow } from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../lib/logging"
import { stampWholesaleOrder, unstampWholesaleOrder } from "../wholesale/orders"

type OrderCreatedHook = (
  handler: (
    input: { order_id: string; cart_id: string },
    context: { container: Parameters<typeof stampWholesaleOrder>[0] }
  ) => Promise<StepResponse<unknown, { order_id: string; account_id: string } | null>>,
  compensate: (
    undo: { order_id: string; account_id: string } | null | undefined,
    context: { container: Parameters<typeof stampWholesaleOrder>[0] }
  ) => Promise<void>
) => void

// Medusa 2.21.2 declares the hook (`createHook("orderCreated", { order_id, cart_id })`)
// without exporting its type on `hooks`
const hooks = completeCartWorkflow.hooks as unknown as { orderCreated: OrderCreatedHook }

/**
 * ADR-0068 Ek 2026-11-15 (2): an order placed by a customer who was an
 * active wholesaler at that moment is a wholesale order, stamped here on
 * the server from the order's own customer (nothing the shopper sends).
 * The stamp never stops a checkout: one that fails is logged and the
 * order stays in the retail list, where staff still see it. Undone with
 * the order if the checkout is rolled back.
 */
hooks.orderCreated(
  async ({ order_id }, { container }) => {
    try {
      const stamped = await stampWholesaleOrder(container, order_id)
      return new StepResponse(stamped, stamped)
    } catch (error) {
      logger.error({ event: "wholesale.order_stamp_failed", order_id, err: errorSummary(error) })
      return new StepResponse(null, null)
    }
  },
  async (undo, { container }) => {
    if (undo) {
      await unstampWholesaleOrder(container, undo)
    }
  }
)
