import type { Context } from "@medusajs/framework/types"
import {
  InjectManager,
  InjectTransactionManager,
  MedusaContext,
  MedusaError,
  MedusaService,
} from "@medusajs/framework/utils"
import { ProvisioningRun } from "./models/provisioning-run"
import type { RunStatus } from "./models/provisioning-run"
import { ProvisioningStep } from "./models/provisioning-step"
import type { StepStatus } from "./models/provisioning-step"
import { PORT_RANGE, STALE_AFTER_MS } from "./types"
import type { OpenRunInput, RunView, StepView } from "./types"

interface Executor {
  execute: (sql: string, params: unknown[]) => Promise<unknown>
}

export type { OpenRunInput, RunView, StepView } from "./types"
export { PORT_RANGE, STALE_AFTER_MS } from "./types"

const RUN_FIELDS = [
  "id",
  "tenant_id",
  "kind",
  "status",
  "provider",
  "requested_by",
  "port",
  "error_code",
  "started_at",
  "finished_at",
  "heartbeat_at",
] as const

async function lock(sharedContext: Context, name: string): Promise<void> {
  await (sharedContext.transactionManager as Executor).execute(
    "SELECT pg_advisory_xact_lock(hashtext(?))",
    [name]
  )
}

const busy = () => new MedusaError(MedusaError.Types.NOT_ALLOWED, "cp.provisioning_busy")

/**
 * The provisioning runs and their steps (adr/0061 §2, §6, Ek C10): what
 * the setup did to each shop, live while it runs and kept after. One run
 * at a time per shop; a run silent for `STALE_AFTER_MS` is taken as dead
 * (its process stopped) and closed `failed` when the next one opens.
 */
class ProvisioningModuleService extends MedusaService({ ProvisioningRun, ProvisioningStep }) {
  /** A new run with its steps `pending`; refused while another of the shop's runs. */
  @InjectTransactionManager()
  async openRun(
    input: OpenRunInput,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RunView> {
    await lock(sharedContext, `provisioning:${input.tenant_id}`)
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE provisioning_run SET status = 'failed', error_code = 'provisioning.interrupted',
              finished_at = now(), updated_at = now()
        WHERE tenant_id = ? AND status = 'running' AND deleted_at IS NULL AND heartbeat_at < ?`,
      [input.tenant_id, new Date(Date.now() - STALE_AFTER_MS)]
    )
    const running = await this.listProvisioningRuns(
      { tenant_id: input.tenant_id, status: "running" },
      { select: ["id"], take: 1 },
      sharedContext
    )
    if (running.length > 0) {
      throw busy()
    }
    const now = new Date()
    const [run] = await this.createProvisioningRuns(
      [
        {
          tenant_id: input.tenant_id,
          kind: input.kind,
          provider: input.provider,
          requested_by: input.requested_by,
          status: "running",
          started_at: now,
          heartbeat_at: now,
        },
      ],
      sharedContext
    )
    if (!run) {
      throw busy()
    }
    await this.createProvisioningSteps(
      input.steps.map((name, position) => ({ run_id: run.id, name, position })),
      sharedContext
    )
    return run
  }

  /**
   * The shop's port: the one its earlier runs had, else the lowest in the
   * range no other shop's run holds and `isFree` finds unused. Allocated
   * under one lock for every shop, so two never get the same.
   */
  @InjectTransactionManager()
  async allocatePort(
    runId: string,
    tenantId: string,
    isFree: (port: number) => Promise<boolean>,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ port: number; reused: boolean }> {
    await lock(sharedContext, "provisioning:ports")
    const manager = sharedContext.transactionManager as Executor
    const [held] = (await manager.execute(
      `SELECT port FROM provisioning_run
        WHERE tenant_id = ? AND port IS NOT NULL AND deleted_at IS NULL
        ORDER BY started_at DESC LIMIT 1`,
      [tenantId]
    )) as { port: number }[]
    let port = held?.port ?? null
    const reused = port !== null
    if (port === null) {
      const taken = new Set(
        (
          (await manager.execute(
            `SELECT DISTINCT port FROM provisioning_run
              WHERE tenant_id <> ? AND port IS NOT NULL AND deleted_at IS NULL`,
            [tenantId]
          )) as { port: number }[]
        ).map((row) => row.port)
      )
      for (let candidate = PORT_RANGE.from; candidate <= PORT_RANGE.to; candidate++) {
        if (!taken.has(candidate) && (await isFree(candidate))) {
          port = candidate
          break
        }
      }
    }
    if (port === null) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "provisioning.no_port")
    }
    await this.updateProvisioningRuns({ id: runId, port }, sharedContext)
    return { port, reused }
  }

  /** The shop's port from its runs; null before one was given. */
  @InjectManager()
  async portOf(tenantId: string, @MedusaContext() sharedContext: Context = {}) {
    const runs = await this.listProvisioningRuns(
      { tenant_id: tenantId, port: { $ne: null } },
      { select: ["port"], order: { started_at: "DESC" }, take: 1 },
      sharedContext
    )
    return runs[0]?.port ?? null
  }

  /** A step begins (again): its attempt counted, the run's heartbeat moved. */
  @InjectTransactionManager()
  async stepStarted(
    runId: string,
    name: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const manager = sharedContext.transactionManager as Executor
    await manager.execute(
      `UPDATE provisioning_step SET status = 'running', attempts = attempts + 1,
              started_at = now(), finished_at = NULL, error_code = NULL, updated_at = now()
        WHERE run_id = ? AND name = ? AND deleted_at IS NULL`,
      [runId, name]
    )
    await this.beat(runId, sharedContext)
  }

  /** A step's outcome: status, whether this run made something, a code, a non-secret output. */
  @InjectTransactionManager()
  async stepEnded(
    runId: string,
    name: string,
    outcome: {
      status: StepStatus
      created?: boolean
      error_code?: string | null
      output?: Record<string, unknown> | null
    },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    const [step] = await this.listProvisioningSteps(
      { run_id: runId, name },
      { select: ["id"], take: 1 },
      sharedContext
    )
    if (!step) {
      return
    }
    await this.updateProvisioningSteps(
      {
        id: step.id,
        status: outcome.status,
        finished_at: new Date(),
        ...(outcome.created === undefined ? {} : { created: outcome.created }),
        ...(outcome.error_code === undefined ? {} : { error_code: outcome.error_code }),
        ...(outcome.output === undefined ? {} : { output: outcome.output }),
      },
      sharedContext
    )
    await this.beat(runId, sharedContext)
  }

  /** The run ends. */
  @InjectTransactionManager()
  async finishRun(
    runId: string,
    status: Exclude<RunStatus, "running">,
    errorCode: string | null,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await this.updateProvisioningRuns(
      { id: runId, status, error_code: errorCode, finished_at: new Date() },
      sharedContext
    )
  }

  /** The shop's runs, newest first, without their steps. */
  @InjectManager()
  async runsOf(
    tenantId: string,
    take = 20,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RunView[]> {
    const runs = await this.listProvisioningRuns(
      { tenant_id: tenantId },
      { select: [...RUN_FIELDS], order: { started_at: "DESC" }, take },
      sharedContext
    )
    return runs
  }

  /** One of the shop's runs with its steps in order; 404 `cp.run_unknown` otherwise. */
  @InjectManager()
  async runOf(
    tenantId: string,
    runId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RunView> {
    const [run] = await this.listProvisioningRuns(
      { id: runId, tenant_id: tenantId },
      { select: [...RUN_FIELDS], take: 1 },
      sharedContext
    )
    if (!run) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.run_unknown")
    }
    const steps = await this.listProvisioningSteps(
      { run_id: runId },
      { order: { position: "ASC" }, take: 100 },
      sharedContext
    )
    return { ...(run as unknown as RunView), steps: steps as unknown as StepView[] }
  }

  /** Whether an earlier run mailed the shop's owner invitation (a setup run again sends none). */
  @InjectManager()
  async ownerInvited(
    tenantId: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    const rows = (await (sharedContext.manager as Executor).execute(
      `SELECT 1 FROM provisioning_step s JOIN provisioning_run r ON r.id = s.run_id
        WHERE r.tenant_id = ? AND s.name IN ('owner_invite', 'resend_invite')
          AND s.status = 'succeeded' AND s.output ->> 'mailed' = 'true'
          AND s.deleted_at IS NULL AND r.deleted_at IS NULL
        LIMIT 1`,
      [tenantId]
    )) as unknown[]
    return rows.length > 0
  }

  /** The run is alive (a step that waits). */
  @InjectTransactionManager()
  async heartbeat(runId: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    await this.beat(runId, sharedContext)
  }

  private async beat(runId: string, sharedContext: Context): Promise<void> {
    await (sharedContext.transactionManager as Executor).execute(
      "UPDATE provisioning_run SET heartbeat_at = now(), updated_at = now() WHERE id = ?",
      [runId]
    )
  }
}

export default ProvisioningModuleService
