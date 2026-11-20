import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { ContentDraft } from "./models/content-draft"
import { DraftUsage } from "./models/draft-usage"

// The month in Turkey, the usage report's and the plan's (adr/0061 Ek C14 review L2):
// a draft asked at 01:00 on the 1st counts in the new month, as the panel shows it
const monthOf = (now: Date) => usagePeriodOf(now)

/** Content drafts and the month's use of them (F10.13, adr/0005). */
class ContentDraftsModuleService extends MedusaService({ ContentDraft, DraftUsage }) {
  /**
   * Counts one draft against the month, if the quota has room: one
   * statement, so two asks at once cannot both take the last one.
   */
  @InjectTransactionManager()
  async claimQuota(
    quota: number,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("content_drafts: the quota is claimed in a transaction")
    }
    const month = monthOf(now)
    // The month's row, made once even when two asks open it together
    await manager.execute(
      `INSERT INTO draft_usage (id, month, count, created_at, updated_at)
       VALUES (?, ?, 0, now(), now())
       ON CONFLICT (month) WHERE deleted_at IS NULL DO NOTHING`,
      [generateEntityId(undefined, "dusage"), month]
    )
    const claimed: unknown[] = await manager.execute(
      `UPDATE draft_usage SET count = count + 1, updated_at = now()
       WHERE month = ? AND deleted_at IS NULL AND count < ?
       RETURNING id`,
      [month, quota]
    )
    return claimed.length > 0
  }

  /**
   * Gives back one claimed in `month` (`YYYY-MM`): an AI call that failed
   * before the service took it (adr/0071 §8). Never below zero.
   */
  @InjectTransactionManager()
  async releaseQuota(month: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = sharedContext.transactionManager as EntityManager | undefined
    if (!manager) {
      throw new Error("content_drafts: the quota is released in a transaction")
    }
    await manager.execute(
      `UPDATE draft_usage SET count = count - 1, updated_at = now()
       WHERE month = ? AND deleted_at IS NULL AND count > 0`,
      [month]
    )
  }

  /** Drafts asked for this month. */
  @InjectManager()
  async usedThisMonth(
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const [row] = await this.listDraftUsages(
      { month: monthOf(now) },
      { take: 1, select: ["count"] },
      sharedContext
    )
    return row?.count ?? 0
  }

  /** Drafts counted in a month's row (`YYYY-MM`): the usage report's LLM use (adr/0061 §5.4). */
  @InjectManager()
  async usedIn(month: string, @MedusaContext() sharedContext: Context = {}): Promise<number> {
    const [row] = await this.listDraftUsages(
      { month },
      { take: 1, select: ["count"] },
      sharedContext
    )
    return row?.count ?? 0
  }

  /**
   * By kind, the suggestions of `source` made since `since`: those offered
   * (not refused by the gate) and those accepted (adr/0074 §4, the
   * acceptance rate). Counts only, no text.
   */
  @InjectManager()
  async decisionsSince(
    source: string,
    since: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<DraftDecisions[]> {
    const manager = sharedContext.manager as EntityManager | undefined
    if (!manager) {
      throw new Error("content_drafts: decisions are read with a manager")
    }
    const rows: { kind: string; offered: string | number; accepted: string | number }[] =
      await manager.execute(
        `SELECT kind,
                count(*) FILTER (WHERE status <> 'refused') AS offered,
                count(*) FILTER (WHERE status = 'approved') AS accepted
         FROM content_draft
         WHERE source = ? AND created_at >= ? AND deleted_at IS NULL
         GROUP BY kind
         ORDER BY kind`,
        [source, since]
      )
    return rows.map((row) => ({
      kind: row.kind,
      offered: Number(row.offered),
      accepted: Number(row.accepted),
    }))
  }
}

/** One kind's suggestions over a period: offered and accepted. */
export interface DraftDecisions {
  kind: string
  offered: number
  accepted: number
}

export default ContentDraftsModuleService
