import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { removePttBarcodeRangeWorkflow } from "../../../../../workflows/shipping/ptt-barcodes"

/**
 * DELETE /admin/shipping-setup/ptt-barcodes/:id: a range entered by
 * mistake, none of whose numbers was handed out; a range in use stays.
 */
export async function DELETE(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const { result } = await removePttBarcodeRangeWorkflow(req.scope).run({ input: { id } })
  if (!result.removed) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "ptt.barcode_range_unknown")
  }
  res.json({ id, deleted: true })
}
