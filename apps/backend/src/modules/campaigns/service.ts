import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
} from "@medusajs/framework/utils"
import type { RecipientTally } from "../../lib/campaigns/types"
import { BulkMessage } from "./models/campaign"
import type { CampaignStatus } from "./models/campaign"
import { BulkMessageRecipient } from "./models/campaign-recipient"

interface Executor {
  execute: <T = unknown>(sql: string, params: unknown[]) => Promise<T>
}

const managerOf = (context: Context): Executor => context.transactionManager as Executor

/** A person fixed to receive a campaign: their hash and the record their address is read from. */
export interface FrozenRecipient {
  recipient_hash: string
  source: "customer" | "consent"
  source_id: string
  customer_id: string | null
}

/** Rows written at a time when a list is fixed. */
const FREEZE_CHUNK = 1_000

/**
 * Bulk messages (adr/0050): campaigns and the people each goes to. The
 * transitions are single statements, so a job and a person acting at once
 * cannot both move a campaign; the list is fixed in one transaction.
 */
class CampaignsModuleService extends MedusaService({ BulkMessage, BulkMessageRecipient }) {
  /**
   * Moves a campaign from one of `from` to `to` with the fields given; false
   * when it was no longer in one of them (someone else moved it first).
   */
  @InjectTransactionManager()
  async transition(
    id: string,
    from: readonly CampaignStatus[],
    to: CampaignStatus,
    fields: Record<string, unknown> = {},
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const columns = Object.keys(fields)
    // The fields are this module's callers' own, never a request's; still, a column is a name
    if (columns.some((column) => !/^[a-z_]{1,40}$/.test(column))) {
      throw new Error(`campaigns: no column ${columns.join(", ")}`)
    }
    const rows = await managerOf(sharedContext).execute<{ id: string }[]>(
      `UPDATE bulk_message SET status = ?, updated_at = now()${columns
        .map((column) => `, "${column}" = ?`)
        .join("")}
       WHERE id = ? AND status IN (${from.map(() => "?").join(", ")}) AND deleted_at IS NULL
       RETURNING id`,
      [to, ...columns.map((column) => toColumn(fields[column])), id, ...from]
    )
    return rows.length > 0
  }

  /**
   * Fixes the campaign's recipients, once: written with the counts in one
   * transaction, so a run cut short leaves nothing half-made. False when
   * the list was fixed already.
   */
  @InjectTransactionManager()
  async freeze(
    id: string,
    recipients: readonly FrozenRecipient[],
    counts: Record<string, unknown>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const claimed = await managerOf(sharedContext).execute<{ id: string }[]>(
      `UPDATE bulk_message SET frozen_at = now(), counts = ?::jsonb, updated_at = now()
       WHERE id = ? AND frozen_at IS NULL AND deleted_at IS NULL RETURNING id`,
      [JSON.stringify(counts), id]
    )
    if (claimed.length === 0) {
      return false
    }
    for (let start = 0; start < recipients.length; start += FREEZE_CHUNK) {
      await this.createBulkMessageRecipients(
        recipients
          .slice(start, start + FREEZE_CHUNK)
          .map((recipient) => ({ ...recipient, campaign_id: id, status: "pending" as const })),
        sharedContext
      )
    }
    return true
  }

  /** The campaign's recipients counted by status and reason. */
  @InjectManager()
  async tally(id: string, @MedusaContext() sharedContext: Context = {}): Promise<RecipientTally[]> {
    const manager = (sharedContext.manager ?? sharedContext.transactionManager) as Executor
    const rows = await manager.execute<{ status: string; reason: string | null; count: string }[]>(
      `SELECT status, reason, count(*) AS count FROM bulk_message_recipient
       WHERE campaign_id = ? AND deleted_at IS NULL GROUP BY status, reason`,
      [id]
    )
    return rows.map((row) => ({
      status: row.status as RecipientTally["status"],
      reason: row.reason,
      count: Number(row.count),
    }))
  }

  /** The hashes another campaign reached since then: the 24-hour rule's (adr/0050 §3). */
  @InjectManager()
  async reachedSince(
    since: Date,
    exceptCampaign: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Set<string>> {
    const manager = (sharedContext.manager ?? sharedContext.transactionManager) as Executor
    const rows = await manager.execute<{ recipient_hash: string }[]>(
      `SELECT DISTINCT recipient_hash FROM bulk_message_recipient
       WHERE sent_at > ? AND status = 'sent' AND campaign_id <> ? AND deleted_at IS NULL`,
      [since, exceptCampaign ?? ""]
    )
    return new Set(rows.map((row) => row.recipient_hash))
  }

  /** Which of these hashes the campaign sent to. */
  @InjectManager()
  async sentAmong(
    id: string,
    hashes: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<Set<string>> {
    const found = new Set<string>()
    for (let start = 0; start < hashes.length; start += FREEZE_CHUNK) {
      const rows = await this.listBulkMessageRecipients(
        {
          campaign_id: id,
          status: "sent",
          recipient_hash: hashes.slice(start, start + FREEZE_CHUNK),
        },
        { select: ["recipient_hash"], take: FREEZE_CHUNK },
        sharedContext
      )
      rows.forEach((row) => found.add(row.recipient_hash))
    }
    return found
  }

  /** A finished campaign's recipients go (adr/0050 §8); returns how many. */
  @InjectTransactionManager()
  async pruneRecipients(
    campaignId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const rows = await managerOf(sharedContext).execute<unknown[]>(
      `DELETE FROM bulk_message_recipient WHERE campaign_id = ? RETURNING id`,
      [campaignId]
    )
    return rows.length
  }
}

/** A value as the column takes it: JSON as text, dates and the rest as they are. */
function toColumn(value: unknown): unknown {
  return value !== null && typeof value === "object" && !(value instanceof Date)
    ? JSON.stringify(value)
    : value
}

export default CampaignsModuleService
