import { z } from "@medusajs/framework/zod"
import { logger } from "../../../lib/logging"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import type WholesaleModuleService from "../../../modules/wholesale/service"
import { NO_CHANGES, pendingLists, syncWholeList } from "../../wholesale/sync"
import type { SyncCounts } from "../../wholesale/sync"
import type { JobType } from "./types"

export const WHOLESALE_SYNC_JOB = "wholesale.sync"

// A request that comes while the job runs is met by another round; a
// list asked for again and again (the nightly run) waits for the next job
const MAX_ROUNDS = 5

export const WholesaleSyncInput = z.object({}).strict()
export type WholesaleSyncInput = z.infer<typeof WholesaleSyncInput>

/**
 * Writes the wholesale lists asked for again (ADR-0068 §4): every variant
 * of the shop through each, 500 at a time. A list's request is met by a
 * pass that started after it; a request made meanwhile keeps the list
 * pending for the next round. Queued by the module's own writes and the
 * nightly run only.
 */
export const wholesaleSync: JobType<WholesaleSyncInput> = {
  input: WholesaleSyncInput,
  singleton: true,
  internal: true,
  resultTtlDays: 1,
  containsPersonalData: false,
  execute: async ({ container, progress }) => {
    const service = container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    let counts: SyncCounts = NO_CHANGES
    let lists = 0
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const pending = await pendingLists(container)
      if (pending.length === 0) {
        break
      }
      for (const [index, list] of pending.entries()) {
        const started = new Date()
        const done = await syncWholeList(container, list, () =>
          progress(Math.min(99, Math.round(((index + 0.5) / pending.length) * 100)))
        )
        await service.recordSynced(list, started)
        counts = {
          created: counts.created + done.created,
          updated: counts.updated + done.updated,
          deleted: counts.deleted + done.deleted,
        }
        lists += 1
      }
    }
    logger.info({ event: "wholesale.synced", lists, ...counts })
    return { summary: { lists, ...counts } }
  },
}
