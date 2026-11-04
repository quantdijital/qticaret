import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { readAddressRows } from "../../../lib/tr-address/file/read-rows"
import { createTurkiyeApi, readTurkiyeApi } from "../../../lib/tr-address/turkiyeapi"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { TR_ADDRESS_MODULE } from "../../../modules/tr-address"
import type {
  TrAddressImportOptions,
  TrAddressImportReport,
} from "../../../modules/tr-address/service"
import type TrAddressModuleService from "../../../modules/tr-address/service"
import type { ImportTrAddressInput, TrAddressImportSummary } from "../types"

// The downloads take most of the time; the import itself the rest
const DOWNLOAD_SHARE = 60
const IMPORTING = 70

type Progress = (percent: number, key: string) => Promise<void>

/** The job's progress (and its heartbeat); a job cancelled meanwhile stops before writing. */
function progressOf(container: MedusaContainer, jobId: string | null | undefined): Progress {
  if (!jobId) {
    return () => Promise.resolve()
  }
  const jobs = container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  return async (percent, key) => {
    if (!(await jobs.reportProgress(jobId, percent, key, true))) {
      throw new ConflictError("async_job.cancelled")
    }
  }
}

interface Loaded {
  rows: unknown[]
  orphans: number
  options: TrAddressImportOptions
}

async function load(input: ImportTrAddressInput, progress: Progress): Promise<Loaded> {
  if (input.source === "file") {
    if (!input.file_path) {
      throw new ValidationError("tr_address.file_required")
    }
    return {
      rows: await readAddressRows(input.file_path),
      orphans: 0,
      options: {
        shouldDeactivateMissing: input.deactivate_missing ?? false,
        sync: { source: "file", dataset_version: null, dataset_last_updated: null },
      },
    }
  }
  const read = await readTurkiyeApi(createTurkiyeApi(), async (done, total) => {
    await progress(Math.round((done / total) * DOWNLOAD_SHARE), "tr_address.sync.downloading")
  })
  return {
    rows: read.rows,
    orphans: read.orphans,
    options: {
      // Checked whole (read.ts): what it lacks is gone
      shouldDeactivateMissing: true,
      sync: {
        source: "turkiyeapi",
        dataset_version: read.meta.datasetVersion,
        dataset_last_updated: read.meta.lastUpdated,
      },
    },
  }
}

const reasonCounts = (report: TrAddressImportReport) =>
  report.rejected.reduce<Record<string, number>>((counts, { reason }) => {
    counts[reason] = (counts[reason] ?? 0) + 1
    return counts
  }, {})

/**
 * Reads the source (TürkiyeAPI's dataset files, or a file) and imports it
 * with its sync record, in one transaction (the module's): a failure
 * anywhere leaves the shop's data as it was. No compensation: the reads
 * change nothing anywhere, and a committed import is kept, since undoing
 * it would bring back the older dataset; only the append-only audit entry
 * comes after it. The rows never leave this step (fifty thousand of them).
 */
export const importTrAddressStep = createStep(
  "tr-address-import",
  async (input: ImportTrAddressInput, { container }) => {
    const progress = progressOf(container, input.job_id)
    await progress(0, "tr_address.sync.downloading")
    const loaded = await load(input, progress)
    await progress(IMPORTING, "tr_address.sync.importing")
    const report = await container
      .resolve<TrAddressModuleService>(TR_ADDRESS_MODULE)
      .importReferenceData(loaded.rows, loaded.options)
    const sync = loaded.options.sync
    const summary: TrAddressImportSummary = {
      skipped: false,
      source: input.source,
      dataset_version: sync?.dataset_version ?? null,
      last_updated: sync?.dataset_last_updated ?? null,
      provinces: report.provinces,
      districts: report.districts,
      neighborhoods: report.neighborhoods,
      rejected: report.rejected.length,
      rejected_reasons: reasonCounts(report),
      orphans: loaded.orphans,
    }
    return new StepResponse({ summary, sync_id: report.sync_id ?? null })
  }
)
