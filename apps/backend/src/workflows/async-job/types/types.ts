import type { MedusaContainer } from "@medusajs/framework/types"
import type { z } from "@medusajs/framework/zod"
import type { AsyncJobRecord } from "../../../modules/async-job/service"

/** A result file written as it is produced, so no export sits whole in memory. */
export interface ResultWriter {
  /** Text is written as UTF-8; bytes (a zip, an xlsx) as they are. */
  write: (chunk: string | Buffer) => Promise<void>
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
  /**
   * Singleton kinds that write the same records share a group and run one
   * at a time between them (an import and a bulk edit both write products).
   */
  group?: string
  resultTtlDays: number
  /** Downloading the result is a personal data read (adr/0011). */
  containsPersonalData: boolean
  /**
   * The job itself is its asker's and the owner's alone, not only its file:
   * its filters say whom it is about (an audit log export of one person).
   */
  privateToAsker?: boolean
  /**
   * Seen, and its file read, by an owner alone; its asker too only while
   * an owner (a migration's report holds the shop's customer list: an owner
   * made admin keeps nothing of it). Stricter than `privateToAsker`.
   */
  ownerOnly?: boolean
  /**
   * Queued only by its own route (an import queued with the file it was
   * sent), never through `POST /admin/async-jobs`, whose input it would trust.
   */
  internal?: boolean
  /**
   * The platform's own upkeep (the address reference data): queued by its
   * schedule alone, never by anyone in the shop, who can do nothing with
   * it. The shop's panel never lists or reaches it (docs/06 principle 10);
   * the operator watches its logs. Implies `internal`.
   */
  platform?: boolean
  /**
   * The platform also runs it on its own schedule (the nightly SEO audit,
   * the sitemap refresh). Those runs, asked for by no one in the shop
   * (`requested_by` null), are its upkeep: left out of the shop's job list
   * and out of reach by id (docs/06 principle 10); the page that shows the
   * result reads it its own way (the SEO page, `/admin/seo/audit`). A run
   * a staff member started shows as any other.
   */
  scheduled?: boolean
  execute: (context: JobContext, input: Input) => Promise<JobResult>
}
