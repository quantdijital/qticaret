import { randomUUID } from "node:crypto"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import {
  ValidationError,
  isProviderError,
  isRetryableError,
  isValidationError,
} from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { fakeInvoicingAllowed } from "../../lib/invoicing"
import type { InvoiceDraft } from "../../lib/invoicing"
import { fakeInvoiceProvider } from "../../lib/invoicing/fake"
import { parasutProvider } from "../../lib/invoicing/parasut/provider"
import type { AdvanceOutcome, InvoiceProvider } from "../../lib/invoicing/provider"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import type { ClaimedInvoice, InvoiceStatus } from "../../modules/einvoice/service"
import { sendMessageWorkflow } from "../messaging/send-message"
import { invoiceDraftFor } from "./draft-source"
import { withParasut } from "./parasut-session"

type Container = Pick<MedusaContainer, "resolve">

export interface AdvanceInvoiceInput {
  invoice_id: string
  /** The claim's lease, as the job took it: a change after another worker took it is refused. */
  lease: string
}

/** Where the invoice stands after the step; `lost` when another worker holds it now. */
export interface AdvancedInvoice {
  status: InvoiceStatus | "lost"
  code: string | null
}

/** A code for the record, never a message that may quote data. */
function codeOf(error: unknown): string {
  if (isProviderError(error)) {
    return `parasut.${error.providerCode}`
  }
  if (isValidationError(error) || isRetryableError(error)) {
    return error.safeMessage
  }
  return "einvoice.error"
}

function providerFor(container: Container, id: string): InvoiceProvider {
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

async function settle(
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
    case "issued": {
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
          pdf_file_id: await storePdf(container, outcome.pdf),
        },
        now
      )
      if (done) {
        await tellCustomer(container, claim.id)
      }
      return { status: done ? "issued" : "lost", code: null }
    }
    case "failed": {
      const status = await invoices.markFailed(claim, outcome.code, now, {
        stop: outcome.stop === true,
      })
      return { status: status ?? "lost", code: outcome.code }
    }
  }
}

/**
 * Moves one claimed invoice on at its program (adr/0034 §7): reads where
 * it stands, asks the program for the next stretch, keeps what it made.
 * Only ids come in and a status goes out: the buyer is read inside and
 * never reaches the workflow's record. A failure is the job's to count.
 * Nothing to undo: each record kept is the program's own and stays true.
 */
const advanceInvoiceStep = createStep(
  "einvoice-advance-invoice",
  async (input: AdvanceInvoiceInput, { container }) => {
    const invoices = container.resolve<EinvoiceModuleService>(EINVOICE_MODULE)
    const [row] = await invoices.listInvoices({ id: input.invoice_id }, { take: 1 })
    const lease = new Date(input.lease)
    if (!row || new Date(row.next_attempt_at).getTime() !== lease.getTime()) {
      return new StepResponse<AdvancedInvoice>({ status: "lost", code: null })
    }
    if (row.status !== "pending" && row.status !== "issuing") {
      return new StepResponse<AdvancedInvoice>({ status: row.status, code: null })
    }
    const claim: ClaimedInvoice = {
      id: row.id,
      order_id: row.order_id,
      kind: row.kind,
      source_id: row.source_id,
      provider: row.provider,
      status: row.status,
      attempts: row.attempts,
      external_id: row.external_id,
      document_id: row.document_id,
      job_id: row.job_id,
      job_started_at: row.job_started_at ? new Date(row.job_started_at) : null,
      lease,
    }
    let draft: InvoiceDraft | null = null
    const now = () => new Date()
    let outcome: AdvanceOutcome
    try {
      outcome = await providerFor(container, row.provider).advance(
        { ...claim, document_type: row.document_type, number: row.number },
        {
          draft: async () => {
            if (!draft) {
              const result = await invoiceDraftFor(container, row)
              if ("problems" in result) {
                throw new ValidationError(result.problems[0] ?? "einvoice.no_lines")
              }
              draft = result.draft
            }
            return draft
          },
          keep: (progress) => invoices.keep(claim, progress, now()),
          now,
        }
      )
    } catch (error) {
      // Counted here, with the claim as it now stands: a code, never a message that may quote data
      logger.warn({
        event: "einvoice.advance_failed",
        invoice_id: row.id,
        err: errorSummary(error),
      })
      outcome = { next: "failed", code: codeOf(error) }
    }
    return new StepResponse(await settle(container, claim, outcome, now()))
  }
)

export const advanceInvoiceWorkflow = createWorkflow(
  "einvoice-advance-invoice",
  (input: AdvanceInvoiceInput) => new WorkflowResponse(advanceInvoiceStep(input))
)
