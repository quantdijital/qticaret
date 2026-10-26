import type { MedusaContainer } from "@medusajs/framework/types"
import { errorSummary, logger } from "../lib/logging"
import { reconcileStock } from "../workflows/stock/reconcile"

/** The stock ledger's nightly check (F3.8, adr/0020): what the events missed is written. */
export default async function stockReconcile(container: MedusaContainer) {
  try {
    const recorded = await reconcileStock(container)
    logger.info({ event: "stock.reconciled", recorded })
  } catch (error) {
    // Another process is running it
    logger.warn({ event: "stock.reconcile_skipped", err: errorSummary(error) })
  }
}

export const config = {
  name: "stock-reconcile",
  schedule: "15 3 * * *",
}
