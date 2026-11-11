import type { Context } from "@medusajs/framework/types"
import { InjectManager, InjectTransactionManager, MedusaContext } from "@medusajs/framework/utils"
import type { UsageReport } from "@qticaret/types/control-plane"
import { nextStanding } from "../../lib/fleet/health-rules"
import type { HealthStanding, ProbeResult } from "../../lib/fleet/health-rules"
import type { HealthState, HealthTarget } from "./models/health"
import { FleetDocuments } from "./service-documents"

interface Executor {
  execute: <T = unknown[]>(sql: string, params?: unknown[]) => Promise<T>
}

export interface UsageSnapshotRow {
  id: string
  tenant_id: string
  reported_at: Date
  received_at: Date
  period: string
  products: number
  orders_this_month: number
  staff: number
  storage_mb: number
  llm_credits_this_month: number
  last_order_at: Date | null
  release_version: string
  release_commit: string
}

export interface HealthStatusRow extends HealthStanding {
  tenant_id: string
  target: HealthTarget
  checked_at: Date
  status_code: number | null
  latency_ms: number | null
  error: string | null
}

export interface HealthCheckRow {
  target: HealthTarget
  checked_at: Date
  ok: boolean
  status_code: number | null
  latency_ms: number | null
  error: string | null
}

const STATUS_FIELDS = [
  "tenant_id",
  "target",
  "state",
  "consecutive_failures",
  "checked_at",
  "last_ok_at",
  "unhealthy_since",
  "status_code",
  "latency_ms",
  "error",
] as const

// Deleted in slices: a long backlog never holds one statement's locks for long
const PRUNE_SLICE = 5_000

/**
 * The fleet module's monitoring (adr/0061 §2 `fleet`, §5.4, Ek C13): the
 * shops' usage snapshots and their health probes. A snapshot's time grows
 * strictly per shop (under the shop's advisory lock); a probe writes its
 * history row and the target's standing together.
 */
export class FleetMonitoring extends FleetDocuments {
  /**
   * Stores a report unless one as new or newer is already stored for the
   * shop (a replayed or out-of-order report): then nothing is written.
   */
  @InjectTransactionManager()
  async recordUsage(
    report: UsageReport,
    receivedAt: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ stored: true; id: string } | { stored: false }> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `usage_snapshot:${report.tenant_id}`,
    ])
    const [newer] = await manager.execute<{ id: string }[]>(
      `SELECT id FROM usage_snapshot WHERE tenant_id = ? AND reported_at >= ?
        AND deleted_at IS NULL LIMIT 1`,
      [report.tenant_id, new Date(report.reported_at)]
    )
    if (newer) {
      return { stored: false }
    }
    const [row] = await this.createUsageSnapshots(
      [
        {
          tenant_id: report.tenant_id,
          reported_at: new Date(report.reported_at),
          received_at: receivedAt,
          period: report.period,
          ...report.counts,
          last_order_at: report.last_order_at ? new Date(report.last_order_at) : null,
          release_version: report.release.version,
          release_commit: report.release.commit,
        },
      ],
      sharedContext
    )
    return { stored: true, id: (row as { id: string }).id }
  }

  /** The undo of `recordUsage` in a failed workflow. */
  @InjectTransactionManager()
  async removeUsageSnapshot(id: string, @MedusaContext() sharedContext: Context = {}) {
    await (sharedContext.transactionManager as Executor).execute(
      "DELETE FROM usage_snapshot WHERE id = ?",
      [id]
    )
  }

  @InjectManager()
  async latestUsage(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<UsageSnapshotRow | null> {
    const [row] = await this.listUsageSnapshots(
      { tenant_id: tenantId },
      { order: { reported_at: "DESC" }, take: 1 },
      sharedContext
    )
    return (row as unknown as UsageSnapshotRow | undefined) ?? null
  }

  /**
   * A probe's result, stored: its history row and the target's new
   * standing, under the target's lock so two probes never lose a failure.
   * The standing before and after (for a log line on a change).
   */
  @InjectTransactionManager()
  async noteProbe(
    tenantId: string,
    result: ProbeResult,
    now: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ from: HealthState | null; to: HealthState }> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute("SELECT pg_advisory_xact_lock(hashtext(?))", [
      `health_standing:${tenantId}:${result.target}`,
    ])
    const [current] = (await this.listHealthStandings(
      { tenant_id: tenantId, target: result.target },
      { take: 1 },
      sharedContext
    )) as unknown as (HealthStatusRow & { id: string })[]
    const standing = nextStanding(current ?? null, result.ok, now)
    const fields = {
      ...standing,
      checked_at: now,
      status_code: result.status_code,
      latency_ms: result.latency_ms,
      error: result.error,
    }
    await this.createHealthChecks(
      [
        {
          tenant_id: tenantId,
          target: result.target,
          checked_at: now,
          ok: result.ok,
          status_code: result.status_code,
          latency_ms: result.latency_ms,
          error: result.error,
        },
      ],
      sharedContext
    )
    if (current) {
      await this.updateHealthStandings({ id: current.id, ...fields }, sharedContext)
    } else {
      await this.createHealthStandings(
        [{ tenant_id: tenantId, target: result.target, ...fields }],
        sharedContext
      )
    }
    return { from: current?.state ?? null, to: standing.state }
  }

  /** The latest standing of each target of these shops. */
  @InjectManager()
  async healthOf(
    tenantIds: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<HealthStatusRow[]> {
    if (tenantIds.length === 0) {
      return []
    }
    const rows = await this.listHealthStandings(
      { tenant_id: [...tenantIds] },
      { select: [...STATUS_FIELDS], take: tenantIds.length * 2 },
      sharedContext
    )
    return rows
  }

  /** A shop's last probes of a target, newest first. */
  @InjectManager()
  async probeHistory(
    tenantId: string,
    target: HealthTarget,
    take: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<HealthCheckRow[]> {
    const rows = await this.listHealthChecks(
      { tenant_id: tenantId, target },
      {
        select: ["target", "checked_at", "ok", "status_code", "latency_ms", "error"],
        order: { checked_at: "DESC" },
        take,
      },
      sharedContext
    )
    return rows
  }

  /** Of a shop's target's probes since a moment: how many, how many answered. */
  @InjectManager()
  async probeTally(
    tenantId: string,
    target: HealthTarget,
    since: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ total: number; ok: number }> {
    const [row] = await (sharedContext.manager as Executor).execute<
      { total: string | number; ok: string | number }[]
    >(
      `SELECT count(*) AS total, count(*) FILTER (WHERE ok) AS ok FROM health_check
        WHERE tenant_id = ? AND target = ? AND checked_at >= ? AND deleted_at IS NULL`,
      [tenantId, target, since]
    )
    return { total: Number(row?.total ?? 0), ok: Number(row?.ok ?? 0) }
  }

  /** A removed shop's snapshots, probes and standings (the e2e cleanup; F16.11's closing). */
  @InjectTransactionManager()
  async forgetMonitoring(tenantId: string, @MedusaContext() sharedContext: Context = {}) {
    const manager = sharedContext.transactionManager as Executor
    for (const table of ["usage_snapshot", "health_check", "health_standing"]) {
      await manager.execute(`DELETE FROM ${table} WHERE tenant_id = ?`, [tenantId])
    }
  }

  /**
   * The retention (Ek C13): usage snapshots before `usageBefore`, probes
   * before `healthBefore`, deleted for good (they hold no personal data
   * and nothing refers to them), in slices. How many went.
   */
  @InjectManager()
  async pruneMonitoring(
    usageBefore: Date,
    healthBefore: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ usage: number; health: number }> {
    const manager = sharedContext.manager as Executor
    const prune = async (table: string, column: string, before: Date) => {
      let total = 0
      for (;;) {
        const gone = await manager.execute(
          `DELETE FROM ${table} WHERE id IN (
             SELECT id FROM ${table} WHERE ${column} < ? LIMIT ${String(PRUNE_SLICE)}
           ) RETURNING id`,
          [before]
        )
        total += gone.length
        if (gone.length < PRUNE_SLICE) {
          return total
        }
      }
    }
    return {
      usage: await prune("usage_snapshot", "reported_at", usageBefore),
      health: await prune("health_check", "checked_at", healthBefore),
    }
  }
}
