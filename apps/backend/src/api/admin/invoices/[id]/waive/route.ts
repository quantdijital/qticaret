import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { waiveReturnDocumentWorkflow } from "../../../../../workflows/einvoice/write-back"
import type { AdminPostInvoiceWaiveType } from "../../validators"

/**
 * POST /admin/invoices/:id/waive (F8 E6): a return that needs no document
 * of its own, with the accountant's exception that applies (the money
 * went back through a payment institution; the invoice's return section
 * signed).
 */
export async function POST(
  req: MedusaRequest<AdminPostInvoiceWaiveType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await waiveReturnDocumentWorkflow(req.scope).run({
    input: { invoice_id: req.params["id"] ?? "", reason: req.validatedBody.reason },
  })
  res.json({ changed: result.changed })
}
