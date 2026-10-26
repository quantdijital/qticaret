import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys, Modules, ReturnStatus } from "@medusajs/framework/utils"
import { ConflictError } from "../../lib/errors"

// Returns still to be received at a location; receiving needs the location
const PENDING_RETURNS = [ReturnStatus.OPEN, ReturnStatus.REQUESTED, ReturnStatus.PARTIALLY_RECEIVED]

/**
 * Keeps a warehouse that still matters (F3.7): the store's default one
 * (new products' stock and the panel write there), any that holds,
 * reserves or awaits stock, and any a return is on its way to. Medusa's
 * delete leaves the location's inventory levels behind, so its stock would
 * go on counting as sellable. Checked before the delete, not with it: a
 * stock entry in between is the one gap left (adr/0020).
 */
export async function keepStockedLocation(
  req: MedusaRequest,
  _res: MedusaResponse,
  next: MedusaNextFunction
) {
  try {
    const id = (req.params as Record<string, string | undefined>)["id"]
    if (!id) {
      next()
      return
    }
    const query = req.scope.resolve(ContainerRegistrationKeys.QUERY)
    const { data: stores } = await query.graph({ entity: "store", fields: ["default_location_id"] })
    const store = stores[0] as { default_location_id?: string | null } | undefined
    if (store?.default_location_id === id) {
      throw new ConflictError("stock.location_is_default")
    }
    const [held] = await req.scope.resolve(Modules.INVENTORY).listInventoryLevels(
      {
        location_id: id,
        $or: [
          { stocked_quantity: { $gt: 0 } },
          { reserved_quantity: { $gt: 0 } },
          { incoming_quantity: { $gt: 0 } },
        ],
      },
      { select: ["id"], take: 1 }
    )
    if (held) {
      throw new ConflictError("stock.location_has_stock")
    }
    const { data: pending } = await query.graph({
      entity: "return",
      fields: ["id"],
      filters: { location_id: id, status: PENDING_RETURNS },
      pagination: { take: 1 },
    })
    if (pending.length > 0) {
      throw new ConflictError("stock.location_has_returns")
    }
    next()
  } catch (error) {
    next(error)
  }
}
