import { turkishDay } from "../../dashboard/period"
import { isProviderError } from "../../errors"
import { differenceOf } from "../provider"
import type { AdvanceContext, AdvanceOutcome, InvoiceProvider, ProgramState } from "../provider"
import type { InvoiceBuyer } from "../types"
import type { EDocumentType, ParasutApi } from "./api"
import { contactAttributes, eArchiveAttributes, hasOwnTaxId, salesInvoiceBody } from "./payload"
import { downloadParasutPdf } from "./pdf"

/**
 * Paraşüt as an invoice program (adr/0034 §4, §7): a contact and a sales
 * invoice, then the inbox decides e-Fatura or e-Arşiv, then a job makes
 * it, then its PDF. Each write is kept as soon as Paraşüt answers it.
 * Paraşüt takes no idempotency key: a write whose outcome is not known is
 * never sent again, it stops for staff to look at Paraşüt first.
 */

/** Runs calls with a live token (`withParasut`): reads, and at most one write, the last. */
export type ParasutSession = <T>(run: (api: ParasutApi, token: string) => Promise<T>) => Promise<T>

// Paraşüt keeps a job's id usable for 15 minutes: after that the invoice is read instead
const JOB_LIFE_MS = 15 * 60_000
// How long a started e-document may take to show before staff are asked to look
const DOCUMENT_PATIENCE_MS = 6 * 3_600_000

const unknownOutcome = (error: unknown) =>
  isProviderError(error) && error.providerCode === "outcome_unknown"

const PROGRAM_TYPES: Readonly<Record<EDocumentType, "e_invoice" | "e_archive">> = {
  e_invoices: "e_invoice",
  e_archives: "e_archive",
}

async function contactFor(session: ParasutSession, buyer: InvoiceBuyer): Promise<string> {
  const found = await session((api, token) =>
    hasOwnTaxId(buyer)
      ? api.findContact(token, { taxNumber: buyer.tax_id })
      : buyer.email
        ? api.findContact(token, { email: buyer.email })
        : Promise.resolve(null)
  )
  return found ?? session((api, token) => api.createContact(token, contactAttributes(buyer)))
}

export function parasutProvider(session: ParasutSession): InvoiceProvider {
  /** The contact and the sales invoice: the invoice is kept the moment Paraşüt has it. */
  async function createInvoice(context: AdvanceContext): Promise<AdvanceOutcome | string> {
    const draft = await context.draft()
    const contactId = await contactFor(session, draft.buyer)
    let created
    try {
      created = await session((api, token) =>
        api.createSalesInvoice(token, salesInvoiceBody(draft, contactId, turkishDay(context.now())))
      )
    } catch (error) {
      if (unknownOutcome(error)) {
        return { next: "failed", code: "einvoice.outcome_unknown", stop: true }
      }
      throw error
    }
    const kept = await context.keep({
      external_id: created.id,
      program_difference: differenceOf(draft, created.gross_total),
    })
    return kept ? created.id : { next: "waiting" }
  }

  /** e-Fatura to the buyer's inbox, or e-Arşiv: the job that makes it. */
  async function startDocument(
    invoiceId: string,
    context: AdvanceContext
  ): Promise<AdvanceOutcome> {
    const draft = await context.draft()
    const inbox = hasOwnTaxId(draft.buyer)
      ? await session((api, token) => api.inboxOf(token, draft.buyer.tax_id))
      : null
    const type: EDocumentType = inbox ? "e_invoices" : "e_archives"
    const attributes = inbox ? { scenario: "basic", to: inbox } : eArchiveAttributes(draft)
    const startedAt = context.now()
    let jobId: string | null
    try {
      jobId = await session((api, token) => api.startEDocument(token, type, invoiceId, attributes))
    } catch (error) {
      if (!unknownOutcome(error)) {
        throw error
      }
      // Never started twice: the invoice is read until its e-document shows
      jobId = null
    }
    return {
      next: "issuing",
      progress: { document_type: PROGRAM_TYPES[type], job_id: jobId, job_started_at: startedAt },
    }
  }

  /** The job's outcome, then the e-document and its PDF. */
  async function follow(
    state: ProgramState & { external_id: string },
    context: AdvanceContext
  ): Promise<AdvanceOutcome> {
    const age = context.now().getTime() - (state.job_started_at?.getTime() ?? 0)
    if (state.job_id && age < JOB_LIFE_MS) {
      const jobId = state.job_id
      const job = await session((api, token) => api.readJob(token, jobId))
      if (job.status === "error") {
        // Paraşüt's messages may quote the buyer: the code only
        return { next: "failed", code: "parasut.job_error" }
      }
      if (job.status !== "done") {
        return { next: "waiting" }
      }
    }
    const invoice = await session((api, token) => api.readSalesInvoice(token, state.external_id))
    const document = invoice.document
    if (!document) {
      return age > DOCUMENT_PATIENCE_MS
        ? { next: "failed", code: "einvoice.document_missing", stop: true }
        : { next: "waiting" }
    }
    const progress = {
      document_id: document.id,
      document_type: PROGRAM_TYPES[document.type],
      number: document.invoice_number ?? "",
      uuid: document.uuid ?? null,
      cancellable_until: document.cancellable_until ? new Date(document.cancellable_until) : null,
    }
    if (!progress.number) {
      return { next: "waiting" }
    }
    if (!state.number && !(await context.keep(progress))) {
      return { next: "waiting" }
    }
    const link = await session((api, token) => api.pdfLink(token, document.type, document.id))
    if (!link) {
      return { next: "waiting" }
    }
    return { next: "issued", progress, pdf: await downloadParasutPdf(link) }
  }

  return {
    id: "parasut",
    async advance(state, context) {
      let externalId = state.external_id
      if (!externalId) {
        const created = await createInvoice(context)
        if (typeof created !== "string") {
          return created
        }
        externalId = created
      }
      if (!state.job_started_at) {
        return startDocument(externalId, context)
      }
      return follow({ ...state, external_id: externalId }, context)
    },
  }
}
