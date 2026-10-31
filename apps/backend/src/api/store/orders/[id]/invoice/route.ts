import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { issuedExchangeInvoicesOf, issuedInvoiceOf } from "./issued"

const view = (invoice: {
  id: string
  number: string | null
  document_type: string | null
  issued_at: Date | string | null
  pdf_file_id: string | null
}) => ({
  id: invoice.id,
  number: invoice.number,
  document_type: invoice.document_type,
  issued_at: invoice.issued_at,
  has_pdf: invoice.pdf_file_id !== null,
})

/**
 * GET /store/orders/:id/invoice (F8, adr/0034): the order's invoice once
 * issued (its number, kind, day and whether its PDF is ready), for its
 * own customer or the holder of its key; null before. An exchange's own
 * invoices beside it (E6b), each PDF read with `?invoice=`.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [invoice, exchanges] = await Promise.all([
    issuedInvoiceOf(req),
    issuedExchangeInvoicesOf(req),
  ])
  res.setHeader("Cache-Control", "no-store")
  res.json({
    invoice: invoice ? view(invoice) : null,
    exchange_invoices: exchanges.map(view),
  })
}
