import { z } from "@medusajs/framework/zod"
import { importTrAddressWorkflow } from "../../tr-address/import-tr-address"
import type { JobType } from "./types"

export const TR_ADDRESS_SYNC_JOB = "tr_address.sync"

const input = z.object({ only_if_changed: z.boolean().default(false) }).strict()

/**
 * The address reference data brought up to TürkiyeAPI's dataset (adr/0008
 * Ek 2026-11-04): queued by `POST /admin/tr-address/sync` (the owner) and
 * by the weekly check, never through the generic jobs route. Its report
 * is the import's counts and the dataset's version; nothing personal.
 */
export const trAddressSync: JobType<z.infer<typeof input>> = {
  input,
  singleton: true,
  resultTtlDays: 30,
  containsPersonalData: false,
  internal: true,
  execute: async ({ container, job }, { only_if_changed }) => {
    const { result } = await importTrAddressWorkflow(container).run({
      input: {
        source: "turkiyeapi",
        only_if_changed,
        actor_id: job.requested_by,
        job_id: job.id,
      },
    })
    return { summary: { ...result } }
  },
}
