import type { MedusaContainer } from "@medusajs/framework/types"
import { isConflictError, isValidationError } from "../lib/errors"
import { errorSummary, logger } from "../lib/logging"
import { enqueueAsyncJobWorkflow } from "../workflows/async-job/enqueue-async-job"
import { TR_ADDRESS_SYNC_JOB } from "../workflows/async-job/types/tr-address-sync"
import { checkTrAddressVersionWorkflow } from "../workflows/tr-address/check-tr-address-version"

/**
 * Keeps the address data on TürkiyeAPI's dataset (adr/0008 Ek 2026-11-04):
 * one `/meta` read a week; only a version (or date) the shop does not have
 * queues the sync job, which checks again and downloads. A shop without
 * any data gets it. TürkiyeAPI publishes about once a year.
 *
 * Weekly, not monthly: Medusa's in-process scheduler (development, tests)
 * waits for the next run with a timer, and Node fires a timer longer than
 * 24.8 days at once, so a monthly schedule would run in a loop.
 */
export default async function trAddressSync(container: MedusaContainer) {
  try {
    const { result } = await checkTrAddressVersionWorkflow(container).run()
    if (result.current) {
      return
    }
    await enqueueAsyncJobWorkflow(container).run({
      input: { type: TR_ADDRESS_SYNC_JOB, input: { only_if_changed: true }, requested_by: null },
    })
  } catch (error) {
    if (isConflictError(error)) {
      // A sync (the owner's) is already queued or running
      return
    }
    logger.warn({
      event: "tr_address.check_failed",
      code: isValidationError(error) ? error.safeMessage : "failed",
      err: errorSummary(error),
    })
  }
}

export const config = {
  name: "tr-address-sync",
  // Mondays 05:10, outside the shop's busy hours
  schedule: "10 5 * * 1",
}
