import { z } from "@medusajs/framework/zod"
import { isConflictError, isValidationError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { importTrAddressWorkflow } from "../../tr-address/import-tr-address"
import type { JobType } from "./types"

export const TR_ADDRESS_SYNC_JOB = "tr_address.sync"

const input = z.object({ only_if_changed: z.boolean().default(false) }).strict()

/**
 * The address reference data brought up to TürkiyeAPI's dataset (adr/0008
 * Ek 2026-11-04): queued by the weekly check, never through the generic
 * jobs route. The platform's own upkeep, not the shop's: no one in the
 * shop acts on it (the owner's ruling, 2026-11-04), so a failure is logged
 * at error level as `tr_address.sync_failed` for the operator's alerting;
 * the shop's data stays as it was. Its report is the import's counts and
 * the dataset's version; nothing personal.
 */
export const trAddressSync: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  resultTtlDays: 30,
  containsPersonalData: false,
  internal: true,
  execute: async ({ container, job }, { only_if_changed }) => {
    try {
      const { result } = await importTrAddressWorkflow(container).run({
        input: {
          source: "turkiyeapi",
          only_if_changed,
          actor_id: job.requested_by,
          job_id: job.id,
        },
      })
      return { summary: { ...result } }
    } catch (error) {
      // A job cancelled meanwhile stopped on purpose; anything else is the operator's to see
      if (!(isConflictError(error) && error.safeMessage === "async_job.cancelled")) {
        logger.error({
          event: "tr_address.sync_failed",
          jobId: job.id,
          code: isValidationError(error) ? error.safeMessage : "failed",
          err: errorSummary(error),
        })
      }
      throw error
    }
  },
}
