import type { MedusaContainer } from "@medusajs/framework/types"
import { settleOpenRefunds } from "../workflows/orders/settle-open-refunds"

/**
 * Order refunds left open by a failure after the provider (review
 * 2026-11-17): each read again, closed when its money is surely back,
 * failed once PayTR shows nothing twice, the shop told when one stays open
 * (`workflows/orders/settle-open-refunds.ts`). Never sends a refund.
 */
export default async function orderRefundSettle(container: MedusaContainer) {
  await settleOpenRefunds(container)
}

export const config = {
  name: "order-refund-settle",
  schedule: "*/5 * * * *",
}
