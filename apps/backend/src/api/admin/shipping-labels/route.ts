import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { bulkLabels } from "../../../workflows/shipping/label"
import type { AdminGetBulkLabelsType } from "./validators"

/**
 * GET /admin/shipping-labels?fulfillment_id=… (F7.7): the picked
 * parcels' labels as one PDF, for one print. They hold recipients'
 * addresses and phones: staff only, a recorded read, never cached; the
 * file is made for the answer and stored nowhere.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, AdminGetBulkLabelsType>,
  res: MedusaResponse
): Promise<void> {
  const labels = await bulkLabels(req.scope, req.validatedQuery.fulfillment_id)
  if (!labels) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "shipping.label_unavailable")
  }
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", 'inline; filename="etiketler.pdf"')
  res.setHeader("Cache-Control", "no-store")
  // How many asked for had no label to print, for the panel to say
  res.setHeader("X-Labels-Missing", String(labels.missing))
  res.send(Buffer.from(labels.pdf))
}
