import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { downloadBirfaturaPdf, saleRefOf } from "../../lib/invoicing/birfatura"
import type { ReportedInvoice } from "../../lib/invoicing/birfatura"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import { attachInvoicePdfWorkflow, recordInvoiceWriteBackWorkflow } from "./write-back"

type Container = Pick<MedusaContainer, "resolve">

const serviceOf = (container: Container) =>
  container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)

/**
 * The BirFatura sale invoice an `OrderId` names (adr/0072 §5): the order by
 * its number, then its first sale or its n-th exchange's, and whether it
 * has its PDF already. Null for an id we never gave, or for an invoice
 * that is not BirFatura's.
 */
export async function findBirfaturaInvoice(
  container: Container,
  birfaturaId: number
): Promise<{ id: string; status: string; pdf_file_id: string | null } | null> {
  const ref = saleRefOf(birfaturaId)
  if (!ref) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["id"],
    // Query takes the number as text, as `store/order-lookup` does
    filters: { display_id: String(ref.display_id) },
  })
  const orderId = (data[0] as { id?: string } | undefined)?.id
  if (!orderId) {
    return null
  }
  let sourceId = orderId
  if (ref.exchange > 0) {
    const exchange = (await serviceOf(container).exchangeSales(orderId))[ref.exchange - 1]
    if (!exchange) {
      return null
    }
    sourceId = exchange.source_id
  }
  const sale = await serviceOf(container).birfaturaSale(orderId, sourceId)
  return sale ? { id: sale.id, status: sale.status, pdf_file_id: sale.pdf_file_id ?? null } : null
}

export interface BirfaturaInvoiceLinkInput {
  invoice_id: string
  /** Null: BirFatura sent no number (`readInvoiceLink`). */
  issued: ReportedInvoice | null
  pdf_url: string
  /**
   * False when the invoice has its PDF: a report sent again (a replay, a
   * retry) never replaces it, whatever link it carries (security review S2).
   * A PDF that failed to download is fetched again on the next report.
   */
  fetch_pdf: boolean
}

/**
 * BirFatura's word that it issued the invoice, kept first and apart from
 * the rest (adr/0072 §6): the order is never listed to it again, whatever
 * happens next. Not undone: it is the trace of a tax document issued
 * outside, as a written number is (adr/0034 §7).
 */
const markReportedStep = createStep(
  "einvoice-birfatura-mark-reported",
  async (input: { invoice_id: string }, { container }) => {
    const first = await serviceOf(container).markReported(input.invoice_id)
    return new StepResponse({ first })
  }
)

/**
 * The PDF from BirFatura's link (its hosts only, `downloadBirfaturaPdf`)
 * into the private store; its key. Undone by removing the file, so a PDF
 * the record does not take leaves nothing behind.
 */
const fetchPdfStep = createStep(
  "einvoice-birfatura-fetch-pdf",
  async (input: { url: string }, { container }) => {
    const pdf = await downloadBirfaturaPdf(input.url)
    const upload = await container.resolve(Modules.FILE).getUploadStream({
      // Not guessable: a local or development store guards files by their name only
      filename: `fatura-${randomUUID()}.pdf`,
      mimeType: "application/pdf",
      access: "private",
    })
    upload.writeStream.end(pdf)
    await upload.promise
    return new StepResponse({ file_id: upload.fileKey }, upload.fileKey)
  },
  async (fileId, { container }) => {
    if (fileId) {
      await container
        .resolve(Modules.FILE)
        .deleteFiles([fileId])
        .catch(() => undefined)
    }
  }
)

/**
 * `invoiceLinkUpdate` (adr/0072 §6): marked reported, then, with a number,
 * the write-back every external program uses (series, number, the same
 * number again changes nothing, another is refused) and the PDF attached
 * (the buyer told it is ready), unless it has one. A refused write-back or
 * a PDF that cannot be fetched fails the run; what was kept before it stays.
 */
export const recordBirfaturaInvoiceWorkflow = createWorkflow(
  "einvoice-birfatura-invoice-link",
  (input: BirfaturaInvoiceLinkInput) => {
    const reported = markReportedStep({ invoice_id: input.invoice_id })
    when({ input }, ({ input }) => input.issued !== null).then(() => {
      const writeBack = transform({ input }, ({ input }) => ({
        invoice_id: input.invoice_id,
        issued: {
          number: input.issued?.number ?? "",
          uuid: null,
          document_type: null,
          issued_at: input.issued?.issued_at ?? new Date(),
        },
      }))
      recordInvoiceWriteBackWorkflow.runAsStep({ input: writeBack })
    })
    when({ input }, ({ input }) => input.issued !== null && input.fetch_pdf).then(() => {
      const pdf = fetchPdfStep(transform({ input }, ({ input }) => ({ url: input.pdf_url })))
      attachInvoicePdfWorkflow.runAsStep({
        input: transform({ input, pdf }, ({ input, pdf }) => ({
          invoice_id: input.invoice_id,
          file_id: pdf.file_id,
        })),
      })
    })
    return new WorkflowResponse(reported)
  }
)
