import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { liraOf } from "../../../../return-requests/view"
import { previewOrderEdit } from "../../../../../../workflows/orders/edit-order"
import { editInputOf } from "../input"
import type { AdminPostOrderEditPreviewType } from "../validators"

/**
 * POST /admin/orders/:id/edit/preview (adr/0033): what the edit would
 * cost the shopper, as exact lira (positive when they owe); nothing kept.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostOrderEditPreviewType>,
  res: MedusaResponse
): Promise<void> {
  const difference = await previewOrderEdit(req.scope, editInputOf(req))
  res.json({ difference: liraOf(difference) })
}
