import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { shipmentLabel } from "../../../../../../../workflows/shipping/label"

/**
 * GET /admin/orders/:id/fulfillments/:fulfillment_id/label (adr/0031): a
 * short-lived link to the parcel's label PDF, kept in private storage. It
 * holds the recipient's address and phone: staff only, a sensitive read.
 * The link itself is never logged.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const url = await shipmentLabel(
    req.scope,
    req.params["id"] ?? "",
    req.params["fulfillment_id"] ?? ""
  )
  if (!url) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "shipping.label_unavailable")
  }
  res.setHeader("Cache-Control", "no-store")
  res.json({ url })
}
