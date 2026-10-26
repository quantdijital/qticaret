import type { ExecArgs } from "@medusajs/framework/types"
import { logger } from "../lib/logging"
import { reconcileStock } from "../workflows/stock/reconcile"

/**
 * Runs once per shop, on the `db:migrate` that brings the stock ledger
 * (F3.8, adr/0020): every level the shop already has gets its opening
 * balance, so the first change after it is written as a change (97 → 3,
 * not +3) and can raise the low-stock alert.
 */
export default async function stockLedgerOpeningBalances({ container }: ExecArgs) {
  const recorded = await reconcileStock(container)
  logger.info({ event: "stock.opening_balances", recorded })
}
