import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { toMedusaAmount } from "../../../../../lib/money"
import { priceListLines } from "../../../../../workflows/pricing/price-list-lines"

/**
 * `GET /admin/price-lists/:id/lines` (F4.1): each price with its product,
 * variant and the variant's own price ("20.50"), and other live lists
 * that price the same variants on overlapping days.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { lines, overlaps } = await priceListLines(req.scope, req.params["id"] ?? "")
  res.json({
    lines: lines.map((line) => ({
      ...line,
      base: line.base === null ? null : toMedusaAmount(line.base),
      price: toMedusaAmount(line.price),
    })),
    overlaps,
  })
}
