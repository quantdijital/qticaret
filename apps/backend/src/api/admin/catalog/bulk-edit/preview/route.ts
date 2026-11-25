import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { previewBulkEdit } from "../../../../../workflows/catalog/bulk-edit/preview"
import type { AdminPostBulkEditPreviewType } from "./validators"

/**
 * `POST /admin/catalog/bulk-edit/preview` (F3.10): what a bulk change
 * would do to the products named (how many change, are so already or are
 * left out, and why) before the `catalog.bulk_edit` job applies it.
 * Nothing is written; a POST for the list it takes, the catalog roles'.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostBulkEditPreviewType>,
  res: MedusaResponse
): Promise<void> {
  res.json({ preview: await previewBulkEdit(req.scope, req.validatedBody) })
}
