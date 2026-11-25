import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaService,
  generateEntityId,
} from "@medusajs/framework/utils"
import { assistantUserGroup } from "../../lib/ai/limits"
import type { AiDailyGroup } from "../../lib/ai/limits"
import { AiDailyUsage } from "./models/ai-daily-usage"
import { AiPreference } from "./models/ai-preference"
import { AiUsage } from "./models/ai-usage"
import { summaryOf, turkeyDayOf, turkeyMonthBounds } from "./usage-summary"
import type { AiUsageSummary, SummaryRow } from "./usage-summary"

export type { AiUsageSummary } from "./usage-summary"

export type AiUsageStatus = "succeeded" | "refused" | "failed" | "timeout" | "cancelled"

/** One attempt as it is recorded (adr/0071 §5); no prompt, no output, no key. */
export interface AiUsageInput {
  task: string
  capability: string
  service: string
  model: string
  funding: "own_key" | "platform_credit"
  status: AiUsageStatus
  input_tokens?: number | null
  output_tokens?: number | null
  /** Pictures sent (a vision task) or given back (an image edit). */
  images?: number | null
  estimated_cost_micros?: number | null
  currency?: string | null
  /** `platform_credit` only: the credits the gateway said it charged (never worked out here). */
  credits?: number | null
  entity_type?: string | null
  entity_id?: string | null
  suggestion_id?: string | null
  duration_ms?: number | null
  error_code?: string | null
  requested_by: string | null
}

const managerOf = (sharedContext: Context): EntityManager => {
  const manager = (sharedContext.transactionManager ?? sharedContext.manager) as
    EntityManager | undefined
  if (!manager) {
    throw new Error("ai: no database manager in the context")
  }
  return manager
}

/** The AI core's records (adr/0071 §5): each call, the services chosen, the day's ceiling. */
class AiModuleService extends MedusaService({ AiUsage, AiPreference, AiDailyUsage }) {
  /**
   * Counts one call against the day's ceiling of its group, if there is
   * room: a single statement, so two asks at the last call cannot both
   * pass. Returns the day claimed (for a release), or null when full.
   */
  @InjectTransactionManager()
  async claimDaily(
    group: AiDailyGroup,
    limit: number,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    if (!Number.isSafeInteger(limit) || limit <= 0) {
      return null
    }
    const day = turkeyDayOf(now)
    const claimed: unknown[] = await managerOf(sharedContext).execute(
      `INSERT INTO ai_daily_usage (id, day, limit_group, count, created_at, updated_at)
       VALUES (?, ?, ?, 1, now(), now())
       ON CONFLICT (day, limit_group) WHERE deleted_at IS NULL
       DO UPDATE SET count = ai_daily_usage.count + 1, updated_at = now()
       WHERE ai_daily_usage.count < ?
       RETURNING id`,
      [generateEntityId(undefined, "aiday"), day, group, limit]
    )
    return claimed.length > 0 ? day : null
  }

  /** Gives back a call claimed on `day` (the call failed before the service took it). */
  @InjectTransactionManager()
  async releaseDaily(
    group: AiDailyGroup,
    day: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await managerOf(sharedContext).execute(
      `UPDATE ai_daily_usage SET count = count - 1, updated_at = now()
       WHERE day = ? AND limit_group = ? AND count > 0 AND deleted_at IS NULL`,
      [day, group]
    )
  }

  /** Calls of a group claimed today. */
  @InjectManager()
  async usedToday(
    group: AiDailyGroup,
    now: Date = new Date(),
    @MedusaContext() sharedContext: Context = {}
  ): Promise<number> {
    const [row] = await this.listAiDailyUsages(
      { day: turkeyDayOf(now), limit_group: group },
      { take: 1, select: ["count"] },
      sharedContext
    )
    return row?.count ?? 0
  }

  /**
   * Remembers the service chosen for a task: the staff member's own and
   * the shop's, each one row (adr/0071 §4).
   */
  @InjectTransactionManager()
  async rememberChoice(
    input: { user_id: string; task: string; service: string },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = managerOf(sharedContext)
    await manager.execute(
      `INSERT INTO ai_preference (id, user_id, task, service, created_at, updated_at)
       VALUES (?, ?, ?, ?, now(), now())
       ON CONFLICT (user_id, task) WHERE user_id IS NOT NULL AND deleted_at IS NULL
       DO UPDATE SET service = excluded.service, updated_at = now()`,
      [generateEntityId(undefined, "aipref"), input.user_id, input.task, input.service]
    )
    await manager.execute(
      `INSERT INTO ai_preference (id, user_id, task, service, created_at, updated_at)
       VALUES (?, NULL, ?, ?, now(), now())
       ON CONFLICT (task) WHERE user_id IS NULL AND deleted_at IS NULL
       DO UPDATE SET service = excluded.service, updated_at = now()`,
      [generateEntityId(undefined, "aipref"), input.task, input.service]
    )
  }

  /** The remembered service for a task: the member's own, else the shop's; null when none. */
  @InjectManager()
  async preferenceOf(
    userId: string | null,
    task: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string | null> {
    if (userId !== null) {
      const [own] = await this.listAiPreferences(
        { user_id: userId, task },
        { take: 1, select: ["service"] },
        sharedContext
      )
      if (own) {
        return own.service
      }
    }
    const [shop] = await this.listAiPreferences(
      { user_id: null, task },
      { take: 1, select: ["service"] },
      sharedContext
    )
    return shop?.service ?? null
  }

  /**
   * A staff member left (docs/kvkk-envanter.md §4): their remembered
   * choices are deleted and their id is emptied from the usage rows; the
   * rows themselves stay, as the shop's record of calls and cost.
   */
  @InjectTransactionManager()
  async forgetStaff(userId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    const manager = managerOf(sharedContext)
    await manager.execute(`DELETE FROM ai_preference WHERE user_id = ?`, [userId])
    // Their own assistant counters (adr/0079 §8) name them; the shop's stays
    await manager.execute(`DELETE FROM ai_daily_usage WHERE limit_group = ?`, [
      assistantUserGroup(userId),
    ])
    await manager.execute(
      `UPDATE ai_usage SET requested_by = NULL, updated_at = now() WHERE requested_by = ?`,
      [userId]
    )
  }

  /** Records one attempt; returns its id. */
  @InjectManager()
  async recordUsage(
    input: AiUsageInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string> {
    const row = await this.createAiUsages(input, sharedContext)
    return row.id
  }

  /** A month's (`YYYY-MM`, Turkey) attempts by service and task, with the estimated cost. */
  @InjectManager()
  async usageSummary(
    month: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AiUsageSummary> {
    const { from, to } = turkeyMonthBounds(month)
    const rows: SummaryRow[] = await managerOf(sharedContext).execute(
      `SELECT service, task, status, currency, funding, count(*)::int AS count,
              coalesce(sum(estimated_cost_micros), 0)::bigint AS cost,
              coalesce(sum(credits), 0)::bigint AS credits
       FROM ai_usage
       WHERE deleted_at IS NULL AND created_at >= ? AND created_at < ?
       GROUP BY service, task, status, currency, funding`,
      [from, to]
    )
    return summaryOf(month, rows)
  }
}

export default AiModuleService
