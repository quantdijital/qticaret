import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { readInvoiceLink } from "../../../../../lib/invoicing/birfatura"
import { errorSummary, logger } from "../../../../../lib/logging"
import { EINVOICE_MODULE } from "../../../../../modules/einvoice"
import type EinvoiceModuleService from "../../../../../modules/einvoice/service"
import {
  findBirfaturaInvoice,
  recordBirfaturaInvoiceWorkflow,
} from "../../../../../workflows/einvoice/birfatura-link"
import { answer, auditBirfatura, refusalCode } from "../../respond"
import type { BirfaturaInvoiceLinkBodyType } from "../../validators"

/**
 * POST /hooks/birfatura/api/invoiceLinkUpdate (adr/0072 §6): BirFatura
 * issued the invoice. Marked reported first (never listed again), then
 * with a number written back and its PDF fetched from BirFatura's hosts.
 * A refusal answers `Success: false` and keeps its code on the record for
 * staff; the number kept before a PDF that failed stays.
 */
export async function POST(
  req: MedusaRequest<BirfaturaInvoiceLinkBodyType>,
  res: MedusaResponse
): Promise<void> {
  const body = req.validatedBody
  const invoice = await findBirfaturaInvoice(req.scope, body.orderId)
  if (!invoice) {
    answer(res, false, "invoice_unknown_order")
    return
  }
  const reading = readInvoiceLink(body)
  const einvoice = req.scope.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  let code: string | null
  try {
    await recordBirfaturaInvoiceWorkflow(req.scope).run({
      input: {
        invoice_id: invoice.id,
        issued: "issued" in reading ? reading.issued : null,
        pdf_url: body.faturaUrl,
      },
    })
    code =
      "issued" in reading
        ? null
        : "missing" in reading
          ? "einvoice.number_missing"
          : reading.problem
  } catch (error) {
    code = refusalCode(error)
    logger.warn({
      event: "birfatura.invoice_link_refused",
      invoice_id: invoice.id,
      code,
      err: errorSummary(error),
    })
  }
  if (code) {
    await einvoice.noteProblem(invoice.id, code)
  }
  await auditBirfatura(req, {
    kind: "mutation",
    action: "birfatura.invoice_reported",
    resource_id: invoice.id,
    outcome: 200,
    changes: { number: "issued" in reading ? reading.issued.number : null, problem: code },
  }).catch((error: unknown) => {
    logger.error({
      event: "audit.write_failed",
      action: "birfatura.invoice_reported",
      err: errorSummary(error),
    })
  })
  if (!code) {
    answer(res, true, "invoice_recorded")
  } else if (code === "einvoice.number_missing") {
    answer(res, true, "invoice_number_missing")
  } else if (code === "einvoice.pdf_download_failed") {
    answer(res, false, "invoice_pdf_failed")
  } else {
    answer(res, false, "invoice_refused")
  }
}
