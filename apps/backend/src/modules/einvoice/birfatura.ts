import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import { InvoiceCancelService } from "./cancel"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export interface PullableInvoice {
  id: string
  order_id: string
  source_id: string
  created_at: Date
}

/**
 * What BirFatura reads and reports (adr/0072): the sale invoices waiting
 * for it, and its word that it issued one. Kept apart from the records
 * every program shares (`records.ts`).
 */
export class InvoiceBirfaturaService extends InvoiceCancelService {
  /**
   * Sale invoices BirFatura is to issue, queued (due, the hold rule passed)
   * within the range: not reported, not cancelled or asked to be; the
   * oldest first, `limit` of them after the first `skip` (the pull reads on
   * past ones it cannot list). No return's document ever.
   */
  async listBirfaturaDue(
    range: { start: Date; end: Date },
    limit: number,
    skip = 0
  ): Promise<PullableInvoice[]> {
    const rows = await this.listInvoices(
      {
        provider: "birfatura",
        kind: "sale",
        status: "pending",
        reported_at: null,
        cancel_requested_at: null,
        created_at: { $gte: range.start, $lte: range.end },
      },
      {
        select: ["id", "order_id", "source_id", "created_at"],
        order: { created_at: "ASC", id: "ASC" },
        take: limit,
        skip,
      }
    )
    return rows.map((row) => ({
      id: row.id,
      order_id: row.order_id,
      source_id: row.source_id,
      created_at: new Date(row.created_at),
    }))
  }

  /**
   * The order's exchange sale invoices, the first queued first: an
   * exchange's place among them names it to BirFatura (`birfaturaOrderId`).
   * Every program's: a record keeps its place if the shop changes program.
   */
  async exchangeSales(orderId: string): Promise<{ id: string; source_id: string }[]> {
    const rows = await this.listInvoices(
      { order_id: orderId, kind: "sale" },
      { select: ["id", "source_id", "created_at"], order: { created_at: "ASC", id: "ASC" } }
    )
    return rows
      .filter((row) => row.source_id !== orderId)
      .map((row) => ({ id: row.id, source_id: row.source_id }))
  }

  /**
   * BirFatura's sale invoice for the order (and the exchange, when one);
   * null when there is none of BirFatura's.
   */
  async birfaturaSale(orderId: string, sourceId: string) {
    const [row] = await this.listInvoices(
      { order_id: orderId, kind: "sale", source_id: sourceId, provider: "birfatura" },
      {
        select: [
          "id",
          "status",
          "number",
          "reported_at",
          "pdf_file_id",
          "listed_at",
          "cancel_requested_at",
        ],
        take: 1,
      }
    )
    return row ?? null
  }

  /**
   * BirFatura said it issued the invoice: kept the first time, before
   * anything it said is checked, so the order is never listed to it again
   * (adr/0072 §6). Whether this was its first word.
   */
  @InjectTransactionManager()
  async markReported(
    id: string,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `UPDATE invoice SET reported_at = ?, updated_at = now()
        WHERE id = ? AND provider = 'birfatura' AND kind = 'sale' AND reported_at IS NULL
          AND deleted_at IS NULL
       RETURNING id`,
      [now, id]
    )) as unknown[]
    return rows.length > 0
  }

  /**
   * The pull is about to hand these out (adr/0072 §6): stamped first, in one
   * statement, and only those still waiting and not asked to be cancelled
   * are kept; the pull answers those alone. A cancel that came between the
   * list and the stamp wins (the invoice is not handed out); one that comes
   * after finds the stamp and flags the invoice for staff (`requestCancel`),
   * never cancelling it unseen (security review S-1). The ids kept.
   */
  @InjectTransactionManager()
  async markListed(
    ids: readonly string[],
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    if (ids.length === 0) {
      return []
    }
    const manager = sharedContext.transactionManager as Executor
    const rows = (await manager.execute(
      `UPDATE invoice SET listed_at = COALESCE(listed_at, ?), updated_at = now()
        WHERE id = ANY(ARRAY(SELECT jsonb_array_elements_text(?::jsonb)))
          AND provider = 'birfatura' AND kind = 'sale' AND status = 'pending'
          AND reported_at IS NULL AND cancel_requested_at IS NULL AND deleted_at IS NULL
       RETURNING id`,
      // A JSON list as one parameter, as the search index passes its ids
      [now, JSON.stringify([...new Set(ids)])]
    )) as { id: string }[]
    return rows.map((row) => row.id)
  }

  /**
   * Why an invoice is stuck, for staff (the invoice card): a code only,
   * never a message that may quote the buyer. The state stays: an issued
   * one stays issued; a cancelled one BirFatura issued all the same says so.
   */
  @InjectTransactionManager()
  async noteProblem(
    id: string,
    code: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE invoice SET last_error = ?, updated_at = now()
        WHERE id = ? AND status IN ('pending', 'issued', 'cancelled') AND deleted_at IS NULL`,
      [code.slice(0, 120), id]
    )
  }
}
