import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { logger } from "../../../../../lib/logging"
import { answer } from "../../respond"
import type { BirfaturaCargoBodyType } from "../../validators"

/**
 * POST /hooks/birfatura/api/orderCargoUpdate (adr/0072 §6): taken and set
 * aside. Parcels leave with the shop's own carriers (adr/0031, adr/0035);
 * a second source of tracking would fight theirs. Only the order's id is
 * logged, never the tracking code or the link.
 */
export function POST(req: MedusaRequest<BirfaturaCargoBodyType>, res: MedusaResponse): void {
  logger.info({
    event: "birfatura.cargo_update_ignored",
    birfatura_order_id: req.validatedBody.orderId,
  })
  answer(res, true, "cargo_ignored")
}
