import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { issuedInvoiceOf } from "./issued"

/**
 * GET /store/orders/:id/invoice (F8, adr/0034): the order's invoice once
 * issued (its number, kind, day and whether its PDF is ready), for its
 * own customer or the holder of its key; null before.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const invoice = await issuedInvoiceOf(req)
  res.setHeader("Cache-Control", "no-store")
  res.json({
    invoice: invoice
      ? {
          number: invoice.number,
          document_type: invoice.document_type,
          issued_at: invoice.issued_at,
          has_pdf: invoice.pdf_file_id !== null,
        }
      : null,
  })
}
