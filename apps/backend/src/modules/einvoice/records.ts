import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { ConflictError, uniqueViolationKeys } from "../../lib/errors"
import { isWrittenBack } from "./models/invoice"
import { InvoiceQueueService } from "./queue"
import type { InvoiceStatus } from "./queue"

export interface WrittenBack {
  number: string
  uuid: string | null
  /** Null when the program does not say (BirFatura, adr/0072 §6): left as it was. */
  document_type: "e_invoice" | "e_archive" | null
  issued_at: Date
}

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

/**
 * What staff and the shop's own program do to invoices (F8, adr/0034 §9):
 * write one back, attach its PDF, start a stopped one again. A canceled
 * order's invoices are in `cancel.ts`.
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
      `SELECT provider, kind, status, number FROM invoice WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [id]
    )) as { provider: string; kind: string; status: string; number: string | null }[]
    if (!row) {
      return null
    }
    if (!isWrittenBack(row.provider)) {
      throw new ConflictError("einvoice.not_external")
    }
    // A return's document is written back as one (`recordReturnDocument`)
    if (row.kind !== "sale") {
      throw new ConflictError("einvoice.not_sale")
    }
    if (row.status === "cancelled") {
      throw new ConflictError("einvoice.cancelled")
    }
    // A sale of gift cards alone: an advance, no invoice is cut for it (security review)
    if (row.status === "waived") {
      throw new ConflictError("einvoice.waived")
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
            SET status = 'issued', number = ?, uuid = COALESCE(?, uuid),
                document_type = COALESCE(?, document_type), issued_at = ?,
                -- The order was canceled meanwhile: staff's flag stays (security review S-2)
                last_error = CASE WHEN cancel_requested_at IS NOT NULL THEN last_error END,
                updated_at = now()
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
   * A return's document issued by the shop (the accountant, 2026-10-31):
   * its gider pusulası's serial, or the number of the return invoice a
   * company sent. Once; the same number again changes nothing, another
   * is a conflict, as with a sale's.
   */
  @InjectTransactionManager()
  async recordReturnDocument(
    id: string,
    input: { number: string; issued_at: Date },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ changed: boolean } | null> {
    const manager = sharedContext.transactionManager as Executor
    const [row] = (await manager.execute(
      `SELECT kind, status, number FROM invoice WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [id]
    )) as { kind: string; status: string; number: string | null }[]
    if (!row) {
      return null
    }
    if (row.kind !== "return") {
      throw new ConflictError("einvoice.not_return")
    }
    if (row.status === "issued") {
      if (row.number === input.number) {
        return { changed: false }
      }
      throw new ConflictError("einvoice.already_issued")
    }
    if (row.status !== "pending") {
      throw new ConflictError("einvoice.return_not_pending")
    }
    try {
      await manager.execute(
        `UPDATE invoice SET status = 'issued', number = ?, issued_at = ?, updated_at = now()
          WHERE id = ?`,
        [input.number, input.issued_at, id]
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
   * A return that needs no document of its own (the accountant's
   * exceptions): the money went back through a bank or payment
   * institution whose document stands in for a gider pusulası, or the
   * buyer filled in and signed the invoice's return section.
   */
  @InjectTransactionManager()
  async waiveReturnDocument(
    id: string,
    reason: "payment_institution" | "signed_return_section",
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ changed: boolean } | null> {
    const manager = sharedContext.transactionManager as Executor
    const [row] = (await manager.execute(
      `SELECT kind, status, document_type FROM invoice WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [id]
    )) as { kind: string; status: string; document_type: string | null }[]
    if (!row) {
      return null
    }
    if (row.kind !== "return") {
      throw new ConflictError("einvoice.not_return")
    }
    // Both exceptions stand in for a gider pusulası; a company's return invoice is always due
    if (row.document_type !== "expense_voucher") {
      throw new ConflictError("einvoice.waive_not_allowed")
    }
    if (row.status === "waived") {
      return { changed: false }
    }
    if (row.status !== "pending") {
      throw new ConflictError("einvoice.return_not_pending")
    }
    await manager.execute(
      `UPDATE invoice SET status = 'waived', waived_reason = ?, updated_at = now() WHERE id = ?`,
      [reason, id]
    )
    return { changed: true }
  }

  /**
   * The PDF of an external program's issued invoice, kept in the private
   * store; the key of the one it replaces, to remove, or null.
   */
  @InjectTransactionManager()
  async attachPdf(
    id: string,
    fileId: string,
    options: { onlyIfEmpty?: boolean } = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ previous: string | null } | null> {
    const manager = sharedContext.transactionManager as Executor
    // Locked: two uploads at once never both take the same file for the one they replace
    const [row] = (await manager.execute(
      `SELECT provider, status, pdf_file_id FROM invoice WHERE id = ? AND deleted_at IS NULL FOR UPDATE`,
      [id]
    )) as { provider: string; status: string; pdf_file_id: string | null }[]
    if (!row) {
      return null
    }
    if (!isWrittenBack(row.provider)) {
      throw new ConflictError("einvoice.not_external")
    }
    if (row.status !== "issued") {
      throw new ConflictError("einvoice.not_issued")
    }
    // A program's report sent twice at once keeps the PDF the first attached (adr/0072 §6)
    if (options.onlyIfEmpty && row.pdf_file_id) {
      throw new ConflictError("einvoice.pdf_present")
    }
    await manager.execute(`UPDATE invoice SET pdf_file_id = ?, updated_at = now() WHERE id = ?`, [
      fileId,
      id,
    ])
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
      waived: 0,
    }
    for (const row of rows) {
      counts[row.status] = row.count
    }
    return counts
  }

  /**
   * Keeps the program's invoice on its record whatever the claim, unless
   * the record holds one already: an invoice made at the program is never
   * lost here. False when it held another (the caller logs the orphan).
   */
  @InjectTransactionManager()
  async adopt(
    id: string,
    externalId: string,
    companyId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `UPDATE invoice SET external_id = ?, company_id = ?, updated_at = now()
        WHERE id = ? AND (external_id IS NULL OR external_id = ?) AND deleted_at IS NULL
       RETURNING id`,
      [externalId, companyId, id, externalId]
    )) as unknown[]
    return rows.length > 0
  }
}
