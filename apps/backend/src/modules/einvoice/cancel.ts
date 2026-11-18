import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { InvoiceRecordsService } from "./records"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/** A canceled order's invoices (adr/0034 §10, adr/0072 §6). */
export class InvoiceCancelService extends InvoiceRecordsService {
  /**
   * The order was canceled (adr/0034 §10). An external program's invoice
   * not yet issued is cancelled here; one issued, one BirFatura said it
   * issued, or one BirFatura's pull already handed out (it may be issued
   * there, adr/0072 §6) is left for staff: marked, kept off the pull, and
   * its id returned for them to be told. A program's own
   * is marked for the job to undo at the program, due at once unless a
   * worker holds it; a stopped one comes back for it.
   */
  @InjectTransactionManager()
  async requestCancel(
    orderId: string,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ needs_document: string[]; withdrawn: string[] }> {
    const manager = sharedContext.transactionManager as Executor
    const withdrawn = (await manager.execute(
      `UPDATE invoice SET status = 'cancelled', updated_at = now()
        WHERE order_id = ? AND kind = 'sale' AND provider IN ('external', 'birfatura')
          AND status = 'pending' AND reported_at IS NULL AND listed_at IS NULL
          AND deleted_at IS NULL
       RETURNING id`,
      [orderId]
    )) as { id: string }[]
    // Once: asked again (the hourly sweep), an invoice already marked rings no bell twice
    const issued = (await manager.execute(
      `UPDATE invoice
          SET last_error = 'einvoice.return_document_needed',
              cancel_requested_at = CASE WHEN status = 'pending'
                                         THEN COALESCE(cancel_requested_at, ?)
                                         ELSE cancel_requested_at END,
              updated_at = now()
        WHERE order_id = ? AND kind = 'sale' AND provider IN ('external', 'birfatura')
          AND (status = 'issued'
               OR (status = 'pending' AND (reported_at IS NOT NULL OR listed_at IS NOT NULL)))
          AND last_error IS DISTINCT FROM 'einvoice.return_document_needed' AND deleted_at IS NULL
       RETURNING id`,
      [now, orderId]
    )) as { id: string }[]
    await manager.execute(
      `UPDATE invoice
          SET cancel_requested_at = ?,
              status = CASE WHEN status = 'failed' THEN 'pending' ELSE status END,
              next_attempt_at = CASE WHEN next_attempt_at <= ? THEN ? ELSE next_attempt_at END,
              updated_at = now()
        WHERE order_id = ? AND kind = 'sale' AND provider NOT IN ('external', 'birfatura')
          AND status IN ('pending', 'issuing', 'issued', 'failed')
          AND cancel_requested_at IS NULL AND deleted_at IS NULL`,
      [now, now, now, orderId]
    )
    return {
      needs_document: issued.map((row) => row.id),
      withdrawn: withdrawn.map((row) => row.id),
    }
  }
}
