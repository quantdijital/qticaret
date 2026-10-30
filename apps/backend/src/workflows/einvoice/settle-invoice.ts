import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  ValidationError,
  isProviderError,
  isRetryableError,
  isValidationError,
} from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { fakeInvoicingAllowed } from "../../lib/invoicing"
import { fakeInvoiceProvider } from "../../lib/invoicing/fake"
import { parasutProvider } from "../../lib/invoicing/parasut/provider"
import type {
  AdvanceOutcome,
  CancelOutcome,
  InvoiceProvider,
  ProgramState,
} from "../../lib/invoicing/provider"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import type { ClaimedInvoice, InvoiceStatus } from "../../modules/einvoice/service"
import { MAX_ATTEMPTS } from "../../modules/einvoice/service"
import { sendMessageWorkflow } from "../messaging/send-message"
import { withParasut } from "./parasut-session"

/**
 * What a claimed invoice's step does with the program's answer (adr/0034
 * §7, §10): keeps it on the record under the claim, stores the PDF, tells
 * the buyer, or undoes a canceled order's invoice.
 */

type Container = Pick<MedusaContainer, "resolve">

/** Where the invoice stands after the step; `lost` when another worker holds it now. */
export interface AdvancedInvoice {
  status: InvoiceStatus | "lost"
  code: string | null
}

const RETURN_NEEDED = "einvoice.return_document_needed"

/** A code for the record, never a message that may quote data. */
export function codeOf(error: unknown): string {
  if (isProviderError(error)) {
    return `parasut.${error.providerCode}`
  }
  if (isValidationError(error) || isRetryableError(error)) {
    return error.safeMessage
  }
  return "einvoice.error"
}

export function providerFor(container: Container, id: string): InvoiceProvider {
  if (id === "parasut") {
    return parasutProvider((run) => withParasut(container, run))
  }
  if (id === "fake" && fakeInvoicingAllowed()) {
    return fakeInvoiceProvider
  }
  // An invoice queued for a fake program cannot go out from a live shop
  throw new ValidationError("einvoice.provider_unavailable")
}

/** The PDF into the shop's private storage (it names the buyer); its key. */
async function storePdf(container: Container, pdf: Buffer): Promise<string> {
  const upload = await container.resolve(Modules.FILE).getUploadStream({
    // Not guessable: a local or development store guards files by their name only
    filename: `fatura-${randomUUID()}.pdf`,
    mimeType: "application/pdf",
    access: "private",
  })
  upload.writeStream.end(pdf)
  await upload.promise
  return upload.fileKey
}

/** Whether the invoice's order was canceled since the claim was taken. */
export async function cancelRequested(container: Container, invoiceId: string) {
  const [row] = await container
    .resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    .listInvoices({ id: invoiceId }, { select: ["cancel_requested_at"], take: 1 })
  return Boolean(row?.cancel_requested_at)
}

/** "Faturanız hazır" to the buyer; an invoice issued stays issued whatever the message does. */
async function tellCustomer(container: Container, invoiceId: string) {
  try {
    await sendMessageWorkflow(container as MedusaContainer).run({
      input: { template: "order.invoiced", resource_id: invoiceId },
    })
  } catch (error) {
    logger.warn({
      event: "einvoice.message_failed",
      invoice_id: invoiceId,
      err: errorSummary(error),
    })
  }
}

/**
 * The order was canceled (adr/0034 §10): the invoice undone at its
 * program, or, too late for that, left issued for a return document with
 * what the program holds of it. Undoing a tax document is not undone
 * again; a failure is tried later, and an issued invoice that still
 * cannot be undone after the last try is left for a return document.
 */
export async function undo(
  container: Container,
  claim: ClaimedInvoice,
  state: ProgramState
): Promise<AdvancedInvoice> {
  const invoices = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  const now = new Date()
  let outcome: CancelOutcome
  try {
    outcome = await providerFor(container, claim.provider).cancel(state, now)
  } catch (error) {
    logger.warn({ event: "einvoice.cancel_failed", invoice_id: claim.id, err: errorSummary(error) })
    if (claim.status === "issued" && claim.attempts + 1 >= MAX_ATTEMPTS) {
      const done = await invoices.markCancelTooLate(claim, RETURN_NEEDED, {}, now)
      return { status: done ? "issued" : "lost", code: RETURN_NEEDED }
    }
    const code = codeOf(error)
    return { status: (await invoices.markFailed(claim, code, now)) ?? "lost", code }
  }
  if (outcome.result === "cancelled") {
    return { status: (await invoices.markCancelled(claim, now)) ? "cancelled" : "lost", code: null }
  }
  const done = await invoices.markCancelTooLate(claim, RETURN_NEEDED, outcome.progress, now)
  return { status: done ? "issued" : "lost", code: RETURN_NEEDED }
}

/** An issued invoice: its PDF stored, then the record; a PDF no record took is removed again. */
async function settleIssued(
  container: Container,
  claim: ClaimedInvoice,
  outcome: Extract<AdvanceOutcome, { next: "issued" }>,
  now: Date
): Promise<AdvancedInvoice> {
  const invoices = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  let fileId: string
  try {
    fileId = await storePdf(container, outcome.pdf)
  } catch (error) {
    logger.warn({
      event: "einvoice.pdf_store_failed",
      invoice_id: claim.id,
      err: errorSummary(error),
    })
    const code = "einvoice.pdf_store_failed"
    return { status: (await invoices.markFailed(claim, code, now)) ?? "lost", code }
  }
  const { progress } = outcome
  const done = await invoices.markIssued(
    claim,
    {
      ...progress,
      uuid: progress.uuid ?? null,
      document_type: progress.document_type ?? "e_archive",
      issued_at: now,
      cancellable_until: progress.cancellable_until ?? null,
      program_difference: progress.program_difference ?? null,
      pdf_file_id: fileId,
    },
    now
  )
  if (!done) {
    // Another worker holds it now: its own answer keeps its own PDF
    await container
      .resolve(Modules.FILE)
      .deleteFiles([fileId])
      .catch((error: unknown) => {
        logger.warn({ event: "einvoice.pdf_cleanup_failed", err: errorSummary(error) })
      })
    return { status: "lost", code: null }
  }
  // An order canceled meanwhile is not told its invoice is ready: the job undoes it next
  if (!(await cancelRequested(container, claim.id))) {
    await tellCustomer(container, claim.id)
  }
  return { status: "issued", code: null }
}

export async function settle(
  container: Container,
  claim: ClaimedInvoice,
  outcome: AdvanceOutcome,
  now: Date
): Promise<AdvancedInvoice> {
  const invoices = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
  switch (outcome.next) {
    case "issuing":
      return {
        status: (await invoices.markIssuing(claim, outcome.progress, now)) ? "issuing" : "lost",
        code: null,
      }
    case "waiting":
      return {
        status: (await invoices.markWaiting(claim, now)) ? claim.status : "lost",
        code: null,
      }
    case "issued":
      return settleIssued(container, claim, outcome, now)
    case "failed": {
      const status = await invoices.markFailed(claim, outcome.code, now, {
        stop: outcome.stop === true,
      })
      return { status: status ?? "lost", code: outcome.code }
    }
  }
}
