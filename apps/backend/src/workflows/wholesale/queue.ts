import type { MedusaContainer } from "@medusajs/framework/types"
import { isConflictError } from "../../lib/errors"
import { enqueueAsyncJobWorkflow } from "../async-job/enqueue-async-job"
import { WHOLESALE_CARTS_JOB } from "../async-job/types/wholesale-carts"
import { WHOLESALE_SYNC_JOB } from "../async-job/types/wholesale-sync"

/**
 * Queues the job that prices every active wholesaler's open carts again
 * (review M2: the flag turned). One already queued or running is no
 * failure: false says so.
 */
export async function queueWholesaleCarts(
  container: MedusaContainer,
  requestedBy: string | null
): Promise<boolean> {
  try {
    await enqueueAsyncJobWorkflow(container).run({
      input: { type: WHOLESALE_CARTS_JOB, input: {}, requested_by: requestedBy },
    })
    return true
  } catch (error) {
    if (isConflictError(error)) {
      return false
    }
    throw error
  }
}

/**
 * Queues the wholesale sync job. One already queued or running picks the
 * new request up in its next round, so that is no failure: false says so.
 */
export async function queueWholesaleSync(
  container: MedusaContainer,
  requestedBy: string | null
): Promise<boolean> {
  try {
    await enqueueAsyncJobWorkflow(container).run({
      input: { type: WHOLESALE_SYNC_JOB, input: {}, requested_by: requestedBy },
    })
    return true
  } catch (error) {
    if (isConflictError(error)) {
      return false
    }
    throw error
  }
}
