import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { returnableLines } from "../../../../../workflows/returns/returnable-lines"

/**
 * GET /admin/orders/:id/returnable (F12.3): what staff may ask back for the
 * shopper, by the shopper's own rules; titles only.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  res.json(await returnableLines(req.scope, req.params["id"] ?? ""))
}
