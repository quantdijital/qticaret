import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { ConflictError } from "../../lib/errors"
import { AsyncJob } from "./models/async-job"

export type AsyncJobRecord = InferTypeOf<typeof AsyncJob>
export type AsyncJobStatus = AsyncJobRecord["status"]

// Progress is written at most this often per job: a loop over many rows
// must not turn into a write per row
const PROGRESS_EVERY_MS = 1_000
// A queued job not started within this time lost its event (a restart
// between commit and delivery); it is failed so it stops blocking its type
export const QUEUED_STALE_MS = 30 * 60 * 1000

const DAY_MS = 24 * 60 * 60 * 1000

/**
 * Long-running task records (F2.8, adr/0014). Status changes go through
 * these methods, each a compare-and-set on the current status: a job runs
 * once, and one the sweeper has failed does not come back as succeeded.
 */
class AsyncJobModuleService extends MedusaService({ AsyncJob }) {
  private readonly lastProgress = new Map<string, number>()

  /** queued → running, a new attempt. A job not queued is not started again. */
  @InjectManager()
  async markRunning(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<AsyncJobRecord> {
    const job = await this.retrieveAsyncJob(id, {}, sharedContext)
    const now = new Date()
    const [started] = await this.updateAsyncJobs(
      {
        selector: { id, status: "queued", attempt: job.attempt },
        data: {
          status: "running",
          attempt: job.attempt + 1,
          started_at: now,
          heartbeat_at: now,
          progress: 0,
        },
      },
      sharedContext
    )
    if (!started) {
      throw new ConflictError("async_job.not_queued")
    }
    return started
  }

  /** Progress (0–100) and a heartbeat, throttled to one write a second unless `force`. */
  async reportProgress(
    id: string,
    progress: number,
    progressKey: string | null = null,
    force = false
  ) {
    const now = Date.now()
    if (!force && now - (this.lastProgress.get(id) ?? 0) < PROGRESS_EVERY_MS) {
      return
    }
    this.lastProgress.set(id, now)
    await this.updateAsyncJobs({
      selector: { id, status: "running" },
      data: {
        progress: Math.max(0, Math.min(100, Math.round(progress))),
        progress_key: progressKey,
        heartbeat_at: new Date(now),
      },
    })
  }

  /** running → succeeded; a job no longer running (swept) is refused, and the workflow undoes its file. */
  async markSucceeded(
    id: string,
    result: { fileId: string | null; summary: Record<string, unknown>; ttlDays: number }
  ): Promise<AsyncJobRecord> {
    this.lastProgress.delete(id)
    const now = new Date()
    const [done] = await this.updateAsyncJobs({
      selector: { id, status: "running" },
      data: {
        status: "succeeded",
        progress: 100,
        result_file_id: result.fileId,
        result_summary: result.summary,
        finished_at: now,
        expires_at: new Date(now.getTime() + result.ttlDays * DAY_MS),
      },
    })
    if (!done) {
      throw new ConflictError("async_job.not_running")
    }
    return done
  }

  /** A failure: the error code only, never its message (it may quote data). A finished job stays as it is. */
  async markFailed(id: string, errorCode: string): Promise<void> {
    this.lastProgress.delete(id)
    await this.updateAsyncJobs({
      selector: { id, status: ["queued", "running"] },
      data: { status: "failed", error_code: errorCode, finished_at: new Date() },
    })
  }

  /**
   * Running jobs silent for `staleMs` become failed (`interrupted`); queued
   * jobs older than QUEUED_STALE_MS become failed (`not_started`). The
   * conditions are part of the update, so a job that beat meanwhile stays.
   */
  @InjectManager()
  async sweepInterrupted(
    staleMs: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<string[]> {
    const now = Date.now()
    const finishedAt = new Date(now)
    const interrupted = await this.updateAsyncJobs(
      {
        selector: { status: "running", heartbeat_at: { $lt: new Date(now - staleMs) } },
        data: { status: "failed", error_code: "interrupted", finished_at: finishedAt },
      },
      sharedContext
    )
    const lost = await this.updateAsyncJobs(
      {
        selector: { status: "queued", created_at: { $lt: new Date(now - QUEUED_STALE_MS) } },
        data: { status: "failed", error_code: "not_started", finished_at: finishedAt },
      },
      sharedContext
    )
    return [...interrupted, ...lost].map((job) => job.id)
  }
}

export default AsyncJobModuleService
