import { randomUUID } from "node:crypto"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../lib/errors"
import { errorSummary, logger } from "../../lib/logging"
import { XLSX_MIME } from "../../lib/sheets"
import { ASYNC_JOB_MODULE } from "../../modules/async-job"
import type AsyncJobModuleService from "../../modules/async-job/service"
import { MIGRATION_MODULE } from "../../modules/migration"
import type MigrationModuleService from "../../modules/migration/service"
import {
  CUSTOMER_FILE_PREFIX,
  MIGRATION_FILE_PREFIX,
  WORDPRESS_FILE_PREFIX,
  migrationRun,
} from "../async-job/types/migration-run"
import type { MigrationRunInput as StoredInput } from "../async-job/types/migration-run"
import { startMigrationWorkflow } from "./start"
import type { StartMigrationInput } from "./start"

export interface RestartMigrationInput {
  run_id: string
  requested_by: string | null
}

const PREFIXES: Readonly<Record<string, string>> = {
  bundle: MIGRATION_FILE_PREFIX,
  customers: CUSTOMER_FILE_PREFIX,
  wordpress: WORDPRESS_FILE_PREFIX,
}

const TYPES: Readonly<Record<string, string>> = {
  json: "application/json",
  xml: "application/xml",
  csv: "text/csv",
  xlsx: XLSX_MIME,
}

/** The run that stopped half-way and what its job was asked: refused for any other run. */
const interruptedRunStep = createStep(
  "migration-restart-read",
  async (input: RestartMigrationInput, { container }) => {
    const [run] = await container
      .resolve<MigrationModuleService>(MIGRATION_MODULE)
      .listMigrationRuns(
        { id: input.run_id },
        { select: ["id", "status", "error_code", "job_id"], take: 1 }
      )
    if (!run) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "migration.run_unknown")
    }
    const [job] =
      run.status === "failed" && run.error_code === "interrupted" && run.job_id
        ? await container
            .resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
            .listAsyncJobs({ id: run.job_id, type: "migration.run" }, { take: 1 })
        : []
    const stored = migrationRun.input.safeParse(job?.input)
    if (!stored.success) {
      throw new ConflictError("migration.run_not_interrupted")
    }
    return new StepResponse(stored.data)
  }
)

/**
 * The stored file copied under a new name, the new run's own (its job
 * deletes it however it ends; the sweep of failed jobs' files would
 * otherwise take it from under it). Gone already: the owner uploads it
 * again. Undone by deleting the copy.
 */
const copySourceStep = createStep(
  "migration-restart-copy",
  async (stored: StoredInput, { container }) => {
    if (!("source_file_id" in stored)) {
      return new StepResponse<string | null, string | null>(null, null)
    }
    const files = container.resolve(Modules.FILE)
    const buffer = await files.getAsBuffer(stored.source_file_id).catch(() => null)
    if (!buffer || buffer.length === 0) {
      throw new ValidationError("migration.source_file_gone")
    }
    const extension = /\.([a-z]+)$/.exec(stored.source_file_id)?.[1] ?? "json"
    const upload = await files.getUploadStream({
      filename: `${PREFIXES[stored.source] ?? MIGRATION_FILE_PREFIX}${randomUUID()}.${extension}`,
      mimeType: TYPES[extension] ?? "application/octet-stream",
      access: "private",
    })
    upload.writeStream.end(buffer)
    await upload.promise
    return new StepResponse<string | null, string | null>(upload.fileKey, upload.fileKey)
  },
  async (copy, { container }) => {
    if (copy) {
      // The start's own undo may have deleted it already
      await container
        .resolve(Modules.FILE)
        .deleteFiles(copy)
        .catch(() => undefined)
    }
  }
)

/** The stopped run marked as started again, so it is not started twice; undone back to `interrupted`. */
const markRestartedStep = createStep(
  "migration-restart-mark",
  async (runId: string, { container }) => {
    await container.resolve<MigrationModuleService>(MIGRATION_MODULE).updateMigrationRuns({
      selector: { id: runId, error_code: "interrupted" },
      data: { error_code: "restarted" },
    })
    return new StepResponse(undefined, runId)
  },
  async (runId, { container }) => {
    if (runId) {
      await container.resolve<MigrationModuleService>(MIGRATION_MODULE).updateMigrationRuns({
        selector: { id: runId, error_code: "restarted" },
        data: { error_code: "interrupted" },
      })
    }
  }
)

/** The interrupted run's file, no longer needed once the new run has its copy (it may hold customers). */
const dropOldSourceStep = createStep(
  "migration-restart-drop-old",
  async (stored: StoredInput, { container }) => {
    if ("source_file_id" in stored) {
      await container
        .resolve(Modules.FILE)
        .deleteFiles(stored.source_file_id)
        .catch((error: unknown) => {
          // The failed jobs' file sweep deletes it within days
          logger.warn({ event: "migration.source_kept", err: errorSummary(error) })
        })
    }
  }
)

/**
 * A run that stopped half-way (its job `interrupted`: a crash, a restart)
 * started again as it was asked (F14, adr/0042 §9): the same source, mode
 * and parcel, from the same stored file. A run met again makes nothing
 * twice: every record is kept against its source key. The stopped run is
 * marked `restarted`, so it is started again once.
 */
export const restartMigrationWorkflow = createWorkflow(
  "migration-restart",
  (input: RestartMigrationInput) => {
    const stored = interruptedRunStep(input)
    const copy = copySourceStep(stored)
    const job = startMigrationWorkflow.runAsStep({
      input: transform({ stored, copy, input }, ({ stored, copy, input }) => {
        const start: StartMigrationInput = {
          source: stored.source,
          source_file_id: copy,
          mode: stored.mode,
          defaults: stored.defaults,
          requested_by: input.requested_by,
          ...("feed_url" in stored ? { feed_url: stored.feed_url } : {}),
          ...("category_base" in stored ? { category_base: stored.category_base } : {}),
          ...("refresh" in stored && stored.refresh.length > 0 ? { refresh: stored.refresh } : {}),
        }
        return start
      }),
    })
    markRestartedStep(input.run_id)
    dropOldSourceStep(stored)
    return new WorkflowResponse(job)
  }
)
