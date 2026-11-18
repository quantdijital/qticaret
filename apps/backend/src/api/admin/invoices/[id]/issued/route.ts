import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { recordInvoiceWriteBackWorkflow } from "../../../../../workflows/einvoice/write-back"
import type { AdminPostInvoiceIssuedType } from "../../validators"

/**
 * POST /admin/invoices/:id/issued (adr/0034 §9): an external program's
 * invoice, issued under this number. Sent again with the same number it
 * changes nothing; another number is refused (409).
 */
export async function POST(
  req: MedusaRequest<AdminPostInvoiceIssuedType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const { result } = await recordInvoiceWriteBackWorkflow(req.scope).run({
    input: {
      invoice_id: req.params["id"] ?? "",
      issued: {
        number: body.number,
        uuid: body.uuid ?? null,
        document_type: body.document_type ?? null,
        issued_at: body.issued_at,
      },
    },
  })
  res.json({ changed: result.changed })
}
