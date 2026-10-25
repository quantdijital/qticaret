import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, emitEventStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { createAsyncJobStep } from "./steps/create-async-job"
import type { EnqueueAsyncJobInput } from "./steps/create-async-job"

export const ASYNC_JOB_QUEUED = "async-job.queued"

/**
 * Queues a long task (F2.8, adr/0014): the record opens as `queued` and an
 * event hands it to the worker's subscriber, outside the request.
 */
export const enqueueAsyncJobWorkflow = createWorkflow(
  "async-job-enqueue",
  (input: EnqueueAsyncJobInput) => {
    const lockKey = transform({ input }, ({ input }) => `async-job:${input.type}`)
    acquireLockStep({ key: lockKey, timeout: 5, ttl: 30 })
    const job = createAsyncJobStep(input)
    emitEventStep({ eventName: ASYNC_JOB_QUEUED, data: { id: job.id } })
    releaseLockStep({ key: lockKey })
    return new WorkflowResponse(job)
  }
)
