import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { logger } from "../lib/logging"
import { ASYNC_JOB_MODULE } from "../modules/async-job"
import type AsyncJobModuleService from "../modules/async-job/service"

const RECORD_TTL_MS = 90 * 24 * 60 * 60 * 1000
const BATCH = 500
// A run handles this many batches; the rest waits for the next day
const MAX_BATCHES = 20

/**
 * Deletes result files past their expiry (7 days for exports) and job
 * records older than 90 days (adr/0014). Results can hold personal data.
 */
export default async function asyncJobRetention(container: MedusaContainer) {
  const service = container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
  let files = 0
  let records = 0
  for (let batch = 0; batch < MAX_BATCHES; batch++) {
    const expired = await service.listAsyncJobs(
      { expires_at: { $lt: new Date() }, result_file_id: { $ne: null } },
      { select: ["id", "result_file_id"], take: BATCH }
    )
    const fileIds = expired.flatMap((job) => (job.result_file_id ? [job.result_file_id] : []))
    if (fileIds.length > 0) {
      await container.resolve(Modules.FILE).deleteFiles(fileIds)
      await service.updateAsyncJobs(expired.map((job) => ({ id: job.id, result_file_id: null })))
      files += fileIds.length
    }
    const old = await service.listAsyncJobs(
      { created_at: { $lt: new Date(Date.now() - RECORD_TTL_MS) }, result_file_id: null },
      { select: ["id"], take: BATCH }
    )
    if (old.length > 0) {
      await service.deleteAsyncJobs(old.map((job) => job.id))
      records += old.length
    }
    if (expired.length < BATCH && old.length < BATCH) {
      break
    }
  }
  logger.info({ event: "async_job.retention", files, records })
}

export const config = {
  name: "async-job-retention",
  schedule: "30 3 * * *",
}
