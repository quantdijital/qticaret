import { randomUUID } from "node:crypto"
import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { ConflictError, ValidationError } from "../../../../../lib/errors"
import { pdfFilename } from "../../../../../lib/invoicing/filename"
import { EINVOICE_MODULE } from "../../../../../modules/einvoice"
import { isWrittenBack } from "../../../../../modules/einvoice/models/invoice"
import type EinvoiceModuleService from "../../../../../modules/einvoice/service"
import { attachInvoicePdfWorkflow } from "../../../../../workflows/einvoice/write-back"
import { readRawBody } from "../../../../http/raw-body"
import { programMayReach } from "../../reach"

const MAX_PDF_BYTES = 5 * 1024 * 1024

/**
 * POST /admin/invoices/:id/pdf (adr/0034 §9): an external program's
 * issued invoice as a PDF, sent as it is (`application/pdf`). Kept in the
 * private store; a file that is not a PDF is refused.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if (!req.headers["content-type"]?.startsWith("application/pdf")) {
    throw new ValidationError("einvoice.pdf_invalid")
  }
  const id = req.params["id"] ?? ""
  // Refused before a byte is kept: a PDF naming its buyer never lies about unreferenced
  const [row] = await req.scope
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices({ id }, { select: ["provider", "status", "kind"], take: 1 })
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "einvoice.unknown")
  }
  if (!isWrittenBack(row.provider)) {
    throw new ConflictError("einvoice.not_external")
  }
  // A return's PDF is staff's signed scan: a program never replaces it
  if (!programMayReach(req, row.kind)) {
    throw new ConflictError("einvoice.not_sale")
  }
  if (row.status !== "issued") {
    throw new ConflictError("einvoice.not_issued")
  }
  const bytes = await readRawBody(req, MAX_PDF_BYTES)
  if (bytes.subarray(0, 5).toString("latin1") !== "%PDF-") {
    throw new ValidationError("einvoice.pdf_invalid")
  }
  const files = req.scope.resolve(Modules.FILE)
  const upload = await files.getUploadStream({
    // Not guessable: a local or development store guards files by their name only
    filename: `fatura-${randomUUID()}.pdf`,
    mimeType: "application/pdf",
    access: "private",
  })
  upload.writeStream.end(bytes)
  await upload.promise
  try {
    await attachInvoicePdfWorkflow(req.scope).run({
      input: { invoice_id: id, file_id: upload.fileKey },
    })
  } catch (error) {
    await files.deleteFiles([upload.fileKey]).catch(() => undefined)
    throw error
  }
  res.json({ has_pdf: true })
}

/** GET /admin/invoices/:id/pdf: the invoice's PDF, for staff (a sensitive read). */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const [row] = await req.scope
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices({ id: req.params["id"] ?? "" }, { take: 1 })
  if (!row?.pdf_file_id) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "einvoice.pdf_missing")
  }
  const pdf = await req.scope.resolve(Modules.FILE).getAsBuffer(row.pdf_file_id)
  res.setHeader("Content-Type", "application/pdf")
  res.setHeader("Content-Disposition", `attachment; filename="${pdfFilename(row.number, row.id)}"`)
  res.setHeader("Cache-Control", "no-store")
  res.send(pdf)
}
