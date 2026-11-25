import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, ValidationError } from "../../../lib/errors"
import { ASYNC_JOB_MODULE } from "../../../modules/async-job"
import { QUEUED_STALE_MS } from "../../../modules/async-job/service"
import type AsyncJobModuleService from "../../../modules/async-job/service"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { exclusiveTypes, jobType } from "../types"

export interface EnqueueAsyncJobInput {
  type: string
  input: unknown
  requested_by: string | null
}

/**
 * Checks a job request against its type (input schema, feature flag, one at
 * a time, with its group's kinds too), lets the type set what the server
 * adds to the input (`prepare`) and opens its `queued` record. The
 * workflow holds a lock per type, or per group, around this step, so two
 * requests cannot both pass the one-at-a-time check.
 */
export const createAsyncJobStep = createStep(
  "async-job-create",
  async (request: EnqueueAsyncJobInput, { container }) => {
    const type = jobType(request.type)
    if (!type) {
      throw new ValidationError("async_job.type_unknown", { field: "type" })
    }
    const parsed = type.input.safeParse(request.input ?? {})
    if (!parsed.success) {
      throw new ValidationError("async_job.input_invalid", { field: "input" })
    }
    if (type.feature) {
      const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
      if (!(await settings.isFeatureEnabled(type.feature))) {
        throw new ValidationError("async_job.type_unknown", { field: "type" })
      }
    }
    const service = container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE)
    if (type.singleton) {
      // A queued job past QUEUED_STALE_MS lost its event; it does not block
      const active = await service.listAsyncJobs(
        {
          type: exclusiveTypes(request.type),
          $or: [
            { status: "running" },
            { status: "queued", created_at: { $gte: new Date(Date.now() - QUEUED_STALE_MS) } },
          ],
        },
        { select: ["id"], take: 1 }
      )
      if (active.length > 0) {
        throw new ConflictError("async_job.already_running")
      }
    }
    const input = type.prepare
      ? await type.prepare(container, parsed.data, request.requested_by)
      : parsed.data
    const job = await service.createAsyncJobs({
      type: request.type,
      input: input as Record<string, unknown>,
      requested_by: request.requested_by,
    })
    return new StepResponse({ id: job.id }, job.id)
  },
  async (id: string | undefined, { container }) => {
    if (id) {
      await container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE).deleteAsyncJobs(id)
    }
  }
)
