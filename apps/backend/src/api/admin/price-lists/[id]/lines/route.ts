import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import { WHOLESALE_MODULE } from "../../../../../modules/wholesale"
import type WholesaleModuleService from "../../../../../modules/wholesale/service"
import { priceListLines } from "../../../../../workflows/pricing/price-list-lines"

/**
 * `GET /admin/price-lists/:id/lines` (F4.1): each price with its product,
 * variant and the variant's own price ("20.50"), and other live lists
 * that price the same variants on overlapping days. The wholesale lists
 * are no overlap here: they are named on the wholesale screens only
 * (ADR-0068 §4, §9).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const [{ lines, overlaps }, owned] = await Promise.all([
    priceListLines(req.scope, req.params["id"] ?? ""),
    req.scope.resolve<WholesaleModuleService>(WHOLESALE_MODULE).ownedIds(),
  ])
  res.json({
    lines: lines.map((line) => ({
      ...line,
      base: line.base === null ? null : toMedusaAmount(line.base),
      price: toMedusaAmount(line.price),
    })),
    overlaps: overlaps.filter((overlap) => !owned.priceListIds.has(overlap.id)),
  })
}
