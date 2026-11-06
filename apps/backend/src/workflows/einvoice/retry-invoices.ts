import type { MedusaContainer } from "@medusajs/framework/types"
import { isConflictError } from "../../lib/errors"
import { serverErrorMessage } from "../../lib/errors/messages"
import { errorSummary, logger } from "../../lib/logging"
import { retryInvoiceWorkflow } from "./write-back"

export interface RetryResult {
  invoice_id: string
  ok: boolean
  /** Why not: the i18n key, and its sentence for the panel. */
  error: string | null
  message: string | null
}

// What a stopped invoice's own retry says when it cannot run: shown as it is
const KNOWN = new Set(["einvoice.not_failed", "einvoice.unknown"])

// A workflow hands a thrown error back as a plain object: its key by shape, never `instanceof`
const keyOf = (error: unknown): string => {
  const shape = (error ?? {}) as { safeMessage?: unknown; message?: unknown }
  const key = isConflictError(error) ? shape.safeMessage : shape.message
  return typeof key === "string" && KNOWN.has(key) ? key : "einvoice.retry_failed"
}

/**
 * "Yeniden dene" for the stopped invoices picked on the queue (F8, KK2):
 * each tried again by its own retry (`retryInvoiceWorkflow`), one after
 * another, as if retried one by one; one failing does not stop the rest.
 * Answers each invoice's outcome, in the order asked.
 */
export async function retryInvoices(
  container: MedusaContainer,
  invoiceIds: string[]
): Promise<RetryResult[]> {
  const results: RetryResult[] = []
  for (const invoiceId of [...new Set(invoiceIds)]) {
    try {
      await retryInvoiceWorkflow(container).run({ input: { invoice_id: invoiceId } })
      results.push({ invoice_id: invoiceId, ok: true, error: null, message: null })
    } catch (error) {
      const key = keyOf(error)
      if (key === "einvoice.retry_failed") {
        logger.warn({ event: "einvoice.bulk_retry_failed", invoiceId, err: errorSummary(error) })
      }
      results.push({
        invoice_id: invoiceId,
        ok: false,
        error: key,
        message: serverErrorMessage(key, "tr"),
      })
    }
  }
  return results
}
