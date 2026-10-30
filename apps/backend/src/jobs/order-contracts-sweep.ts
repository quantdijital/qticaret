import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { keepMissedOrderContracts } from "../workflows/legal/order-copies"

/**
 * The hourly check of the orders' contracts (F13.2, adr/0041 §2): an order
 * whose `order.placed` handler failed still gets the copy it must keep.
 */
export default async function orderContractsSweep(container: MedusaContainer) {
  try {
    const kept = await keepMissedOrderContracts(container)
    if (kept > 0) {
      logger.warn({ event: "legal.order_contracts_swept", orders: kept })
    }
  } catch (error) {
    logger.error({ event: "legal.order_contracts_sweep_failed", err: errorSummary(error) })
  }
}

export const config = {
  name: "order-contracts-sweep",
  schedule: "23 * * * *",
}
