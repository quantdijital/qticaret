import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { ConflictError, ValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import type { WrittenBack } from "../../modules/einvoice/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { InvoicingSettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { sendMessageWorkflow } from "../messaging/send-message"

/**
 * An external program's invoice written back (F8, adr/0034 §9): by the
 * shop's program with its key, or by staff typing it in (a program not
 * connected, such as Luca). Nothing to undo: the number is the issued
 * invoice's own, written once.
 */

/**
 * The number in the shop's web sales series, when it set one (the
 * accountant, 2026-10-31): an invoice typed in from another series is a
 * mistake to catch before it is the record's for good.
 */
async function assertSeries(container: Pick<MedusaContainer, "resolve">, number: string) {
  const { values } = await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .readSection("invoicing")
  const series = (values as unknown as InvoicingSettings).series
  if (series && !number.startsWith(series)) {
    throw new ValidationError("einvoice.series_mismatch", { field: "number" })
  }
}

const recordWriteBackStep = createStep(
  "einvoice-record-write-back",
  async (input: { invoice_id: string; issued: WrittenBack }, { container }) => {
    await assertSeries(container, input.issued.number)
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
      // The new PDF is on the record already: an old file left over is only logged
      await container
        .resolve(Modules.FILE)
        .deleteFiles([input.previous])
        .catch((error: unknown) => {
          logger.warn({ event: "einvoice.pdf_cleanup_failed", err: errorSummary(error) })
        })
    }
    return new StepResponse(null)
  }
)

/**
 * "Faturanız hazır" when an invoice issued elsewhere gets its first PDF:
 * the buyer can download it now. A message that fails leaves the PDF kept.
 */
const tellCustomerStep = createStep(
  "einvoice-tell-customer",
  async (input: { invoice_id: string; previous: string | null }, { container }) => {
    if (!input.previous) {
      try {
        await sendMessageWorkflow(container).run({
          input: { template: "order.invoiced", resource_id: input.invoice_id },
        })
      } catch (error) {
        logger.warn({
          event: "einvoice.message_failed",
          invoice_id: input.invoice_id,
          err: errorSummary(error),
        })
      }
    }
    return new StepResponse(null)
  }
)

export const attachInvoicePdfWorkflow = createWorkflow(
  "einvoice-attach-pdf",
  (input: { invoice_id: string; file_id: string }) => {
    const attached = attachPdfStep(input)
    removePreviousPdfStep(attached)
    tellCustomerStep(
      transform({ input, attached }, ({ input, attached }) => ({
        invoice_id: input.invoice_id,
        previous: attached.previous,
      }))
    )
    return new WorkflowResponse(attached)
  }
)

/**
 * Staff start a stopped invoice again (KK2): it carries on from where it
 * stopped at its program, never from the start. Nothing to undo.
 */
const retryInvoiceStep = createStep(
  "einvoice-retry-invoice",
  async (input: { invoice_id: string }, { container }) => {
    const retried = await container
      .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
      .retry(input.invoice_id)
    if (!retried) {
      throw new ConflictError("einvoice.not_failed")
    }
    return new StepResponse(null)
  }
)

export const retryInvoiceWorkflow = createWorkflow(
  "einvoice-retry-invoice",
  (input: { invoice_id: string }) => new WorkflowResponse(retryInvoiceStep(input))
)
