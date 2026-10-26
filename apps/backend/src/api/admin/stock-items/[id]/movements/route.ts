import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { Modules } from "@medusajs/framework/utils"
import { STOCK_LEDGER_MODULE } from "../../../../../modules/stock-ledger"
import type StockLedgerModuleService from "../../../../../modules/stock-ledger/service"
import type { AdminGetStockMovementsType } from "../../validators"

/** `GET /admin/stock-items/:id/movements` (F3.8): what changed the item's stock, newest first. */
export async function GET(
  req: MedusaRequest<unknown, AdminGetStockMovementsType>,
  res: MedusaResponse
): Promise<void> {
  const { offset, limit } = req.validatedQuery
  const [movements, count] = await req.scope
    .resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
    .listAndCountStockMovements(
      { inventory_item_id: req.params["id"] ?? "" },
      { order: { seq: "DESC" }, skip: offset, take: limit }
    )
  const ids = [...new Set(movements.map((movement) => movement.location_id))]
  const locations = ids.length
    ? await req.scope
        .resolve(Modules.STOCK_LOCATION)
        .listStockLocations({ id: ids }, { select: ["id", "name"] })
    : []
  const names = new Map(locations.map((location) => [location.id, location.name]))
  res.json({
    movements: movements.map((movement) => ({
      id: movement.id,
      created_at: movement.created_at,
      location_id: movement.location_id,
      location_name: names.get(movement.location_id) ?? null,
      delta_stocked: movement.delta_stocked,
      stocked_after: movement.stocked_after,
      delta_reserved: movement.delta_reserved,
      reserved_after: movement.reserved_after,
      reason: movement.reason,
      reference: movement.reference,
      actor_id: movement.actor_id,
    })),
    count,
    offset,
    limit,
  })
}
