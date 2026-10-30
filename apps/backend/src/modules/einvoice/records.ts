import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { ConflictError, uniqueViolationKeys } from "../../lib/errors"
import { InvoiceQueueService } from "./queue"
import type { InvoiceStatus } from "./queue"

export interface WrittenBack {
  number: string
  uuid: string | null
  document_type: "e_invoice" | "e_archive"
  issued_at: Date
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/**
 * What staff and the shop's own program do to invoices (F8, adr/0034 §9,
 * §10): write one back, attach its PDF, start a stopped one again, and
 * ask for a canceled order's invoice to be undone.
 */
export class InvoiceRecordsService extends InvoiceQueueService {
  /**
   * An external program's invoice, written back (adr/0034 §9): the number
   * it issued under, once. The same number again is the same answer;
   * another number, or a number another invoice holds, is a conflict.
   */
  @InjectTransactionManager()
  async recordWriteBack(
    id: string,
    input: WrittenBack,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ changed: boolean } | null> {
    const manager = sharedContext.transactionManager as Executor
    const [row] = (await manager.execute(
      `SELECT provider, status, number FROM invoice WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [id]
    )) as { provider: string; status: string; number: string | null }[]
    if (!row) {
      return null
    }
    if (row.provider !== "external") {
      throw new ConflictError("einvoice.not_external")
    }
    if (row.status === "cancelled") {
      throw new ConflictError("einvoice.cancelled")
    }
    if (row.status === "issued") {
      if (row.number === input.number) {
        return { changed: false }
      }
      throw new ConflictError("einvoice.already_issued")
    }
    try {
      await manager.execute(
        `UPDATE invoice
            SET status = 'issued', number = ?, uuid = ?, document_type = ?, issued_at = ?,
                last_error = NULL, updated_at = now()
          WHERE id = ?`,
        [input.number, input.uuid, input.document_type, input.issued_at, id]
      )
    } catch (error) {
      if (uniqueViolationKeys(error)?.includes("number")) {
        throw new ConflictError("einvoice.number_taken")
      }
      throw error
    }
    return { changed: true }
  }

  /**
   * The PDF of an external program's issued invoice, kept in the private
   * store; the key of the one it replaces, to remove, or null.
   */
  async attachPdf(id: string, fileId: string): Promise<{ previous: string | null } | null> {
    const [row] = await this.listInvoices({ id }, { take: 1 })
    if (!row) {
      return null
    }
    if (row.provider !== "external") {
      throw new ConflictError("einvoice.not_external")
    }
    if (row.status !== "issued") {
      throw new ConflictError("einvoice.not_issued")
    }
    await this.updateInvoices({ id, pdf_file_id: fileId })
    return { previous: row.pdf_file_id }
  }

  /** Staff ask a stopped invoice to be tried again: it carries on from where it stopped. */
  async retry(id: string, now: Date = new Date()): Promise<boolean> {
    const [row] = await this.listInvoices({ id, status: "failed" }, { take: 1 })
    if (!row) {
      return false
    }
    await this.updateInvoices({
      id,
      status: row.job_id ? "issuing" : "pending",
      attempts: 0,
      next_attempt_at: now,
    })
    return true
  }

  /** How many invoices are in each state. */
  @InjectManager()
  async counts(
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Record<InvoiceStatus, number>> {
    const manager = sharedContext.manager as Executor
    const rows = (await manager.execute(
      `SELECT status, count(*)::integer AS count FROM invoice
        WHERE deleted_at IS NULL GROUP BY status`,
      []
    )) as { status: InvoiceStatus; count: number }[]
    const counts: Record<InvoiceStatus, number> = {
      pending: 0,
      issuing: 0,
      issued: 0,
      failed: 0,
      cancelled: 0,
    }
    for (const row of rows) {
      counts[row.status] = row.count
    }
    return counts
  }

  /**
   * The order was canceled (adr/0034 §10). An external program's invoice
   * not yet issued is cancelled here; one issued is left for a return
   * document, and its id returned for staff to be told. A program's own
   * is marked for the job to undo at the program, due at once unless a
   * worker holds it; a stopped one comes back for it.
   */
  @InjectTransactionManager()
  async requestCancel(
    orderId: string,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ needs_document: string[] }> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE invoice SET status = 'cancelled', updated_at = now()
        WHERE order_id = ? AND kind = 'sale' AND provider = 'external' AND status = 'pending'
          AND deleted_at IS NULL`,
      [orderId]
    )
    const issued = (await manager.execute(
      `UPDATE invoice SET last_error = 'einvoice.return_document_needed', updated_at = now()
        WHERE order_id = ? AND kind = 'sale' AND provider = 'external' AND status = 'issued'
          AND deleted_at IS NULL
       RETURNING id`,
      [orderId]
    )) as { id: string }[]
    await manager.execute(
      `UPDATE invoice
          SET cancel_requested_at = ?,
              status = CASE WHEN status = 'failed' THEN 'pending' ELSE status END,
              next_attempt_at = CASE WHEN next_attempt_at <= ? THEN ? ELSE next_attempt_at END,
              updated_at = now()
        WHERE order_id = ? AND kind = 'sale' AND provider <> 'external'
          AND status IN ('pending', 'issuing', 'issued', 'failed')
          AND cancel_requested_at IS NULL AND deleted_at IS NULL`,
      [now, now, now, orderId]
    )
    return { needs_document: issued.map((row) => row.id) }
  }
}
