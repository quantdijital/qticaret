import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BIRFATURA_STATUSES, birfaturaTexts } from "../../../../../lib/invoicing/birfatura"

/**
 * POST /hooks/birfatura/api/orderStatus (adr/0072 §5): our order states as
 * BirFatura maps them, read when the shop sets up or edits its BirFatura
 * store. Only "Faturaya hazır" returns orders. The token was checked
 * before this runs (`birfatura-routes.ts`).
 */
export function POST(_req: MedusaRequest, res: MedusaResponse): void {
  const texts = birfaturaTexts().statuses
  res.setHeader("Cache-Control", "no-store")
  res.json({
    OrderStatus: [
      { Id: BIRFATURA_STATUSES.ready, Value: texts.ready },
      { Id: BIRFATURA_STATUSES.invoiced, Value: texts.invoiced },
      { Id: BIRFATURA_STATUSES.cancelled, Value: texts.cancelled },
    ],
  })
}
