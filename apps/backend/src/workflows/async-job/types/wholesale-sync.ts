import { z } from "@medusajs/framework/zod"
import { logger } from "../../../lib/logging"
import { WHOLESALE_MODULE } from "../../../modules/wholesale"
import type WholesaleModuleService from "../../../modules/wholesale/service"
import type { WholesaleList } from "../../../modules/wholesale/service"
import { NO_CHANGES, pendingLists, syncWholeList } from "../../wholesale/sync"
import type { SyncCounts } from "../../wholesale/sync"
import type { JobContext, JobType } from "./types"

export const WHOLESALE_SYNC_JOB = "wholesale.sync"

// A request that comes while the job runs is met by another round; a
// list asked for again and again (the nightly run) is left to the sweep
const MAX_ROUNDS = 5

export const WholesaleSyncInput = z.object({}).strict()
export type WholesaleSyncInput = z.infer<typeof WholesaleSyncInput>

const add = (a: SyncCounts, b: SyncCounts): SyncCounts => ({
  created: a.created + b.created,
  updated: a.updated + b.updated,
  deleted: a.deleted + b.deleted,
})

/**
 * One pending list written. It is read again once the pass has its start
 * time, so the rate written is the one standing then (a change made since
 * the job listed it is not lost under an older rate); a level taken away
 * meanwhile, before or during the pass, is passed by.
 */
async function syncOne(
  context: JobContext,
  service: WholesaleModuleService,
  pending: WholesaleList,
  onPage: () => Promise<void>
): Promise<SyncCounts | null> {
  const started = new Date()
  const list = await service.wholesaleList(pending)
  if (!list) {
    return null
  }
  try {
    const done = await syncWholeList(context.container, list, onPage)
    await service.recordSynced(list, started)
    return done
  } catch (error) {
    if (!(await service.wholesaleList(pending))) {
      return null
    }
    throw error
  }
}

/**
 * Writes the wholesale lists asked for again (ADR-0068 §4): every variant
 * of the shop through each, 500 at a time. A list's request is met by a
 * pass that started after it; a request made meanwhile keeps the list
 * pending for the next round, and one still pending when the rounds run
 * out is queued again by the sweep (`jobs/wholesale-sweep.ts`). Queued by
 * the module's own writes, the nightly run and the sweep only.
 */
export const wholesaleSync: JobType<WholesaleSyncInput> = {
  input: WholesaleSyncInput,
  singleton: true,
  internal: true,
  managersOnly: true,
  resultTtlDays: 1,
  containsPersonalData: false,
  execute: async (context) => {
    const service = context.container.resolve<WholesaleModuleService>(WHOLESALE_MODULE)
    let counts: SyncCounts = NO_CHANGES
    let lists = 0
    let skipped = 0
    for (let round = 0; round < MAX_ROUNDS; round++) {
      const pending = await pendingLists(context.container)
      if (pending.length === 0) {
        break
      }
      for (const [index, list] of pending.entries()) {
        const done = await syncOne(context, service, list, () =>
          context.progress(Math.min(99, Math.round(((index + 0.5) / pending.length) * 100)))
        )
        if (done) {
          counts = add(counts, done)
          lists += 1
        } else {
          skipped += 1
        }
      }
    }
    const left = (await pendingLists(context.container)).length
    if (left > 0) {
      logger.warn({ event: "wholesale.sync_left_pending", left })
    }
    logger.info({ event: "wholesale.synced", lists, skipped, ...counts })
    return { summary: { lists, skipped, left, ...counts } }
  },
}
