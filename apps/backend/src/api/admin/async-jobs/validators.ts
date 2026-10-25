import { z } from "@medusajs/framework/zod"
import { ASYNC_JOB_STATUSES } from "../../../modules/async-job/models/async-job"

/** A job request; `input` is checked against the type's own schema in the workflow. */
export const AdminPostAsyncJob = z
  .object({
    type: z.string().min(1).max(64),
    input: z.record(z.string().max(64), z.unknown()).optional(),
  })
  .strict()
export type AdminPostAsyncJobType = z.infer<typeof AdminPostAsyncJob>

export const AdminGetAsyncJobs = z.object({
  type: z.string().min(1).max(64).optional(),
  status: z.enum(ASYNC_JOB_STATUSES).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).max(100_000).default(0),
})
export type AdminGetAsyncJobsType = z.infer<typeof AdminGetAsyncJobs>
