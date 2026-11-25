import type { Context } from "@medusajs/framework/types"
import { InjectManager, MedusaContext } from "@medusajs/framework/utils"
import type { AiCreditOrderStatus } from "@qticaret/types/control-plane"
import type { AiCreditBucket, AiCreditEntryKind } from "./models/entry"
import { rowsOf } from "./sql"
import type { Executor } from "./sql"
import { ORDER_COLUMNS } from "./service-orders"
import type { AiCreditOrderRow } from "./service-orders"
import { AiCreditSettings } from "./service-settings"

/** A ledger row as staff read it. */
export interface AiCreditEntryView {
  id: string
  kind: AiCreditEntryKind
  amount: number
  bucket: AiCreditBucket
  operation_id: string | null
  grant_ref: string | null
  note: string | null
  actor: string
  created_at: Date
}

export interface Page<T> {
  rows: T[]
  count: number
}

/** At most this many rows a page. */
export const READ_PAGE_MAX = 100

const pageOf = (limit: number, offset: number) => ({
  limit: Math.min(Math.max(Math.trunc(limit), 1), READ_PAGE_MAX),
  offset: Math.max(Math.trunc(offset), 0),
})

/**
 * What staff and a shop read (adr/0085 §5, §2): a shop's ledger newest
 * first, the requests by status, a shop's pending request. Reads only.
 */
export class AiCreditReads extends AiCreditSettings {
  @InjectManager()
  async ledgerOf(
    tenantId: string,
    page: { limit: number; offset: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Page<AiCreditEntryView>> {
    const { limit, offset } = pageOf(page.limit, page.offset)
    const manager = sharedContext.manager as Executor
    const [rows, [total]] = await Promise.all([
      rowsOf<AiCreditEntryView>(
        manager,
        `SELECT id, kind, amount, bucket, operation_id, grant_ref, note, actor, created_at
           FROM ai_credit_entry WHERE tenant_id = ? AND deleted_at IS NULL
          ORDER BY created_at DESC, id DESC LIMIT ? OFFSET ?`,
        [tenantId, limit, offset]
      ),
      rowsOf<{ count: string }>(
        manager,
        "SELECT count(*)::text AS count FROM ai_credit_entry WHERE tenant_id = ? AND deleted_at IS NULL",
        [tenantId]
      ),
    ])
    return { rows, count: Number(total?.count ?? 0) }
  }

  /** Every shop's requests, newest first; `status` narrows them. */
  @InjectManager()
  async ordersByStatus(
    status: AiCreditOrderStatus | null,
    page: { limit: number; offset: number },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Page<AiCreditOrderRow>> {
    const { limit, offset } = pageOf(page.limit, page.offset)
    const manager = sharedContext.manager as Executor
    const [rows, [total]] = await Promise.all([
      rowsOf<AiCreditOrderRow>(
        manager,
        `SELECT ${ORDER_COLUMNS} FROM ai_credit_order
          WHERE deleted_at IS NULL AND (?::text IS NULL OR status = ?)
          ORDER BY requested_at DESC, id DESC LIMIT ? OFFSET ?`,
        [status, status, limit, offset]
      ),
      rowsOf<{ count: string }>(
        manager,
        `SELECT count(*)::text AS count FROM ai_credit_order
          WHERE deleted_at IS NULL AND (?::text IS NULL OR status = ?)`,
        [status, status]
      ),
    ])
    return { rows, count: Number(total?.count ?? 0) }
  }

  /** A shop's own day's cap; null for the platform's (or no wallet). */
  @InjectManager()
  async ownDailyCapOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number | null> {
    const [row] = await rowsOf<{ daily_cap: number | null }>(
      sharedContext.manager as Executor,
      "SELECT daily_cap FROM ai_credit_wallet WHERE tenant_id = ? AND deleted_at IS NULL",
      [tenantId]
    )
    return row?.daily_cap ?? null
  }

  /** A shop's pending request, or null (a shop has at most one). */
  @InjectManager()
  async pendingOrderOf(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiCreditOrderRow | null> {
    const [row] = await rowsOf<AiCreditOrderRow>(
      sharedContext.manager as Executor,
      `SELECT ${ORDER_COLUMNS} FROM ai_credit_order
        WHERE tenant_id = ? AND status = 'pending' AND deleted_at IS NULL`,
      [tenantId]
    )
    return row ?? null
  }
}
