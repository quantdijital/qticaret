import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import {
  executeAsyncJobStep,
  markAsyncJobRunningStep,
  markAsyncJobSucceededStep,
} from "./steps/run-async-job"

/** Runs a queued job to its end (adr/0014); the subscriber marks it failed if this throws. */
export const runAsyncJobWorkflow = createWorkflow("async-job-run", (input: { id: string }) => {
  markAsyncJobRunningStep(input.id)
  const executed = executeAsyncJobStep(input.id)
  markAsyncJobSucceededStep(executed)
  return new WorkflowResponse({ id: input.id })
})
