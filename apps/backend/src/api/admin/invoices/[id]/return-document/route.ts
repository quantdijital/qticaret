import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { recordReturnDocumentWorkflow } from "../../../../../workflows/einvoice/write-back"
import type { AdminPostReturnDocumentType } from "../../validators"

/**
 * POST /admin/invoices/:id/return-document (F8 E6, adr/0034 addendum): a
 * return's document the shop issued (its gider pusulası) or received (a
 * company's return invoice), entered by its number. Its PDF follows on
 * `POST /admin/invoices/:id/pdf`, as a sale's.
 */
export async function POST(
  req: MedusaRequest<AdminPostReturnDocumentType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await recordReturnDocumentWorkflow(req.scope).run({
    input: {
      invoice_id: req.params["id"] ?? "",
      number: req.validatedBody.number,
      issued_at: req.validatedBody.issued_at,
    },
  })
  res.json({ changed: result.changed })
}
