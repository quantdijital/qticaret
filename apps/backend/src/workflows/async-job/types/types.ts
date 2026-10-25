import type { MedusaContainer } from "@medusajs/framework/types"
import type { z } from "@medusajs/framework/zod"
import type { AsyncJobRecord } from "../../../modules/async-job/service"

/** A result file written as it is produced, so no export sits whole in memory. */
export interface ResultWriter {
  write: (text: string) => Promise<void>
}

export interface JobContext {
  container: MedusaContainer
  job: AsyncJobRecord
  /**
   * Progress 0–100 with an optional i18n key, written at most once a second;
   * it is also the heartbeat, so a job calls it at least every few minutes
   * (the sweeper fails a job silent for 10).
   */
  progress: (percent: number, key?: string) => Promise<void>
  /** Opens the job's private result file; one per job. */
  resultFile: (filename: string, mimeType: string) => Promise<ResultWriter>
}

export interface JobResult {
  summary: Record<string, unknown>
}

/** A kind of long task (adr/0014): what it takes, what it may run beside, how long its result lives. */
export interface JobType<Input = unknown> {
  input: z.ZodType<Input>
  /** A feature flag the job needs on (adr/0012). */
  feature?: string
  /** One at a time: a second request while one is queued or running is refused. */
  singleton: boolean
  resultTtlDays: number
  /** Downloading the result is a personal data read (adr/0011). */
  containsPersonalData: boolean
  execute: (context: JobContext, input: Input) => Promise<JobResult>
}
