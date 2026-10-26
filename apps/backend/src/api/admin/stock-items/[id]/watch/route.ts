import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { lowStockThresholds } from "../../../../../lib/stock"
import { STOCK_LEDGER_MODULE } from "../../../../../modules/stock-ledger"
import type StockLedgerModuleService from "../../../../../modules/stock-ledger/service"
import { setStockThresholdWorkflow } from "../../../../../workflows/stock/ledger"
import type { AdminPostStockWatchType } from "../../validators"

// A watch is kept by the item's id: an id that names no item gets none
async function itemId(req: MedusaRequest): Promise<string> {
  const id = req.params["id"] ?? ""
  const [item] = await req.scope
    .resolve(Modules.INVENTORY)
    .listInventoryItems({ id }, { select: ["id"], take: 1 })
  if (!item) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "stock.item_unknown")
  }
  return item.id
}

async function watchOf(req: MedusaRequest, id: string) {
  const [watch] = await req.scope
    .resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
    .listStockWatches({ inventory_item_id: id }, { take: 1 })
  const thresholds = await lowStockThresholds(req.scope, [id])
  return { threshold: watch?.threshold ?? null, fallback: thresholds.fallback }
}

/** `GET /admin/stock-items/:id/watch` (F3.8): the item's own low-stock threshold and the shop's. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.json({ watch: await watchOf(req, await itemId(req)) })
}

/** `POST /admin/stock-items/:id/watch`: the item's own low-stock threshold, or null for the shop's. */
export async function POST(
  req: MedusaRequest<AdminPostStockWatchType>,
  res: MedusaResponse
): Promise<void> {
  const id = await itemId(req)
  await setStockThresholdWorkflow(req.scope).run({
    input: { inventory_item_id: id, threshold: req.validatedBody.threshold },
  })
  res.json({ watch: await watchOf(req, id) })
}
