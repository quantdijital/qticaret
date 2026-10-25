import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { isConflictError, isValidationError } from "../lib/errors"
import { errorSummary, logger } from "../lib/logging"
import { ASYNC_JOB_MODULE } from "../modules/async-job"
import type AsyncJobModuleService from "../modules/async-job/service"
import { ASYNC_JOB_QUEUED } from "../workflows/async-job/enqueue-async-job"
import { runAsyncJobWorkflow } from "../workflows/async-job/run-async-job"

/**
 * Starts a queued job (adr/0014); in production this runs in the worker
 * process (Redis event bus, F16). A job already started (the same event
 * delivered twice) is left alone; any other failure marks the job failed
 * with a code, never the error's text.
 */
export default async function asyncJobQueued({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    // One run per job, even if the event comes twice at once
    await runAsyncJobWorkflow(container).run({
      input: { id: data.id },
      context: { transactionId: `async-job-run:${data.id}` },
    })
  } catch (error) {
    // Already started elsewhere: nothing to do. Any other conflict (a job
    // swept meanwhile, a type's own refusal) is a failure like the rest
    if (isConflictError(error) && error.safeMessage === "async_job.not_queued") {
      return
    }
    logger.error({ event: "async_job.failed", jobId: data.id, err: errorSummary(error) })
    const code = isValidationError(error) ? error.safeMessage : "failed"
    await container.resolve<AsyncJobModuleService>(ASYNC_JOB_MODULE).markFailed(data.id, code)
  }
}

export const config: SubscriberConfig = {
  event: ASYNC_JOB_QUEUED,
}
