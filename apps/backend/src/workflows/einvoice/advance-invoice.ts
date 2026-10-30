import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import type { InvoiceDraft } from "../../lib/invoicing"
import type { AdvanceOutcome } from "../../lib/invoicing/provider"
import { EINVOICE_MODULE } from "../../modules/einvoice"
import type EinvoiceModuleService from "../../modules/einvoice/service"
import type { ClaimedInvoice } from "../../modules/einvoice/service"
import { invoiceDraftFor } from "./draft-source"
import { cancelRequested, codeOf, providerFor, settle, undo } from "./settle-invoice"
import type { AdvancedInvoice } from "./settle-invoice"

export type { AdvancedInvoice } from "./settle-invoice"

type Container = Pick<MedusaContainer, "resolve">

export interface AdvanceInvoiceInput {
  invoice_id: string
  /** The claim's lease, as the job took it: a change after another worker took it is refused. */
  lease: string
}

/** Whether the order was canceled: an invoice queued just before never goes out unmarked. */
async function orderCanceled(container: Container, orderId: string): Promise<boolean> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ["status", "canceled_at"],
    filters: { id: orderId },
  })
  const order = data[0] as { status?: string | null; canceled_at?: unknown } | undefined
  return !order || order.status === "canceled" || Boolean(order.canceled_at)
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
    const status = row.status
    const undoing = status === "issued" && row.cancel_requested_at !== null
    if (status !== "pending" && status !== "issuing" && !undoing) {
      return new StepResponse<AdvancedInvoice>({ status, code: null })
    }
    const claim: ClaimedInvoice = {
      id: row.id,
      order_id: row.order_id,
      kind: row.kind,
      source_id: row.source_id,
      provider: row.provider,
      status: status === "issued" ? "issued" : status === "issuing" ? "issuing" : "pending",
      attempts: row.attempts,
      external_id: row.external_id,
      document_id: row.document_id,
      job_id: row.job_id,
      job_started_at: row.job_started_at ? new Date(row.job_started_at) : null,
      cancel_requested_at: row.cancel_requested_at ? new Date(row.cancel_requested_at) : null,
      company_id: row.company_id,
      lease,
    }
    const state = {
      ...claim,
      document_type: row.document_type,
      number: row.number,
      cancellable_until: row.cancellable_until ? new Date(row.cancellable_until) : null,
    }
    if (!claim.cancel_requested_at && (await orderCanceled(container, row.order_id))) {
      // Its cancellation came before its invoice: marked now, undone below
      await invoices.requestCancel(row.order_id)
      claim.cancel_requested_at = new Date()
    }
    if (claim.cancel_requested_at) {
      return new StepResponse(await undo(container, claim, state))
    }
    let draft: InvoiceDraft | null = null
    const now = () => new Date()
    let outcome: AdvanceOutcome
    try {
      outcome = await providerFor(container, row.provider).advance(state, {
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
        adopt: async (externalId, companyId) => {
          if (!(await invoices.adopt(row.id, externalId, companyId))) {
            // Made at the program while another worker held the record: staff reconcile it
            logger.error({
              event: "einvoice.orphan_invoice",
              invoice_id: row.id,
              external_id: externalId,
            })
          }
        },
        cancelRequested: () => cancelRequested(container, row.id),
        now,
      })
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
