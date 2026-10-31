import { once } from "node:events"
import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { jobType } from "../types"
import type { ResultWriter } from "../types"

export const markAsyncJobRunningStep = createStep(
  "async-job-mark-running",
  async (id: string, { container }) => {
    await container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE).markRunning(id)
    return new StepResponse(id)
  }
)

export interface ExecutedJob {
  id: string
  fileId: string | null
  summary: Record<string, unknown>
  ttlDays: number
}

interface OpenFile {
  writer: ResultWriter
  finish: () => Promise<void>
  abort: () => void
  key: string
}

// A private file streamed to storage; writes wait while the stream is full
async function openResultFile(
  container: MedusaContainer,
  filename: string,
  mimeType: string
): Promise<OpenFile> {
  const upload = await container
    .resolve(Modules.FILE)
    .getUploadStream({ filename, mimeType, access: "private" })
  const stream = upload.writeStream
  return {
    key: upload.fileKey,
    writer: {
      write: async (chunk) => {
        if (!stream.write(chunk)) {
          await once(stream, "drain")
        }
      },
    },
    finish: async () => {
      stream.end()
      await upload.promise
    },
    abort: () => {
      stream.destroy()
    },
  }
}

/**
 * Runs the job's type, its result streamed to a private file. A failure
 * here, or later in the workflow, deletes the file again.
 */
export const executeAsyncJobStep = createStep(
  "async-job-execute",
  async (id: string, { container }) => {
    const service = container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    const job = await service.retrieveAsyncJob(id)
    const type = jobType(job.type)
    if (!type) {
      throw new ValidationError("async_job.type_unknown")
    }
    let file: OpenFile | undefined
    try {
      const result = await type.execute(
        {
          container,
          job,
          // Cancelled meanwhile: the job stops here, its file dropped below
          progress: async (percent, key) => {
            if (!(await service.reportProgress(id, percent, key ?? null))) {
              throw new ConflictError("async_job.cancelled")
            }
          },
          resultFile: async (filename, mimeType) => {
            file = await openResultFile(container, filename, mimeType)
            return file.writer
          },
        },
        type.input.parse(job.input ?? {})
      )
      await file?.finish()
      const executed: ExecutedJob = {
        id,
        fileId: file?.key ?? null,
        summary: result.summary,
        ttlDays: type.resultTtlDays,
      }
      return new StepResponse(executed, executed.fileId)
    } catch (error) {
      if (file) {
        file.abort()
        await container
          .resolve(Modules.FILE)
          .deleteFiles(file.key)
          .catch(() => undefined)
      }
      throw error
    }
  },
  async (fileId: string | null | undefined, { container }) => {
    if (fileId) {
      await container.resolve(Modules.FILE).deleteFiles(fileId)
    }
  }
)

export const markAsyncJobSucceededStep = createStep(
  "async-job-mark-succeeded",
  async (executed: ExecutedJob, { container }) => {
    await container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE).markSucceeded(executed.id, {
      fileId: executed.fileId,
      summary: executed.summary,
      ttlDays: executed.ttlDays,
    })
    return new StepResponse(executed.id)
  }
)
