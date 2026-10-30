import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { pdfFilename } from "../../../../../../lib/invoicing/filename"
import { issuedInvoiceOf } from "../issued"

/** GET /store/orders/:id/invoice/pdf: the invoice's PDF, from the shop's private storage. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const invoice = await issuedInvoiceOf(req)
  if (!invoice?.pdf_file_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "einvoice.pdf_missing")
  }
  const pdf = await req.scope.resolve(Modules.FILE).getAsBuffer(invoice.pdf_file_id)
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader(
    "Content-Disposition",
    `attachment; filename="${pdfFilename(invoice.number, invoice.id)}"`
  )
  res.setHeader("Cache-Control", "no-store")
  res.send(pdf)
}
