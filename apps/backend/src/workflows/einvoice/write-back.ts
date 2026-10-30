import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import type { WrittenBack } from "../../modules/einvoice/service"

/**
 * An external program's invoice written back (F8, adr/0034 §9): by the
 * shop's program with its key, or by staff typing it in (a program not
 * connected, such as Luca). Nothing to undo: the number is the issued
 * invoice's own, written once.
 */

const recordWriteBackStep = createStep(
  "einvoice-record-write-back",
  async (input: { invoice_id: string; issued: WrittenBack }, { container }) => {
    const result = await container
      .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      .recordWriteBack(input.invoice_id, input.issued)
    if (!result) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "einvoice.unknown")
    }
    return new StepResponse(result)
  }
)

export const recordInvoiceWriteBackWorkflow = createWorkflow(
  "einvoice-record-write-back",
  (input: { invoice_id: string; issued: WrittenBack }) =>
    new WorkflowResponse(recordWriteBackStep(input))
)

/**
 * The PDF the route stored, put on the invoice; the one it replaces is
 * removed. Undone by removing the new file, so a refused PDF leaves none
 * behind.
 */
const attachPdfStep = createStep(
  "einvoice-attach-pdf",
  async (input: { invoice_id: string; file_id: string }, { container }) => {
    const result = await container
      .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      .attachPdf(input.invoice_id, input.file_id)
    if (!result) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "einvoice.unknown")
    }
    return new StepResponse(result, input.file_id)
  },
  async (fileId, { container }) => {
    if (fileId) {
      await container.resolve(Modules.FILE).deleteFiles([fileId])
    }
  }
)

const removePreviousPdfStep = createStep(
  "einvoice-remove-previous-pdf",
  async (input: { previous: string | null }, { container }) => {
    if (input.previous) {
      await container.resolve(Modules.FILE).deleteFiles([input.previous])
    }
    return new StepResponse(null)
  }
)

export const attachInvoicePdfWorkflow = createWorkflow(
  "einvoice-attach-pdf",
  (input: { invoice_id: string; file_id: string }) => {
    const attached = attachPdfStep(input)
    removePreviousPdfStep(attached)
    return new WorkflowResponse(attached)
  }
)
