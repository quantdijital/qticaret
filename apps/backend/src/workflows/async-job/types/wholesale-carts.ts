import { z } from "@medusajs/framework/zod"
import { logger } from "../../../lib/logging"
import { activeWholesalers } from "../../wholesale/accounts/wholesalers"
import { wholesaleListsState } from "../../wholesale/lists-status"
import { repriceCustomerCarts } from "../../wholesale/steps/carts"
import type { JobContext, JobType } from "./types"

export const WHOLESALE_CARTS_JOB = "wholesale.carts"

// The lists changed during a pass: priced again, a few times at most
const MAX_ROUNDS = 3

/**
 * A run that ends unsettled is queued again by the sweep
 * (`requeueUnsettledCarts`), this many times at most: 1 + 3 runs of
 * MAX_ROUNDS passes each, then an error in the log and the night's run.
 */
export const MAX_CARTS_REQUEUES = 3

export const WholesaleCartsInput = z
  .object({
    // Which re-run of an unsettled job this is (0, or none: the flag's own)
    attempt: z.number().int().min(0).max(MAX_CARTS_REQUEUES).optional(),
  })
  .strict()
export type WholesaleCartsInput = z.infer<typeof WholesaleCartsInput>

/**
 * Every open cart of every active wholesaler priced again (security
 * review M2): the flag turned off drafts the wholesale lists, so their
 * carts go to retail; turned on, back to wholesale. A cart that fails
 * twice is counted in the summary, never dropped silently. Queued by the
 * flag's hook, and again by the sweep when a run ended unsettled; seen by
 * the owner and admin, as the sync is.
 */
export const wholesaleCarts: JobType<WholesaleCartsInput> = {
  input: WholesaleCartsInput,
  singleton: true,
  internal: true,
  managersOnly: true,
  resultTtlDays: 1,
  containsPersonalData: false,
  execute: async (context: JobContext, input: WholesaleCartsInput) => {
    const attempt = input.attempt ?? 0
    let wholesalers = 0
    let repriced = 0
    let failed = 0
    let settled = false
    // The job is one at a time: a flag turned again while it runs queues
    // nothing, and the carts it already passed keep the old prices. A pass
    // is settled only if the lists did not change during it: their state
    // carries each list's last write, so off and on again inside one pass
    // counts as a change even though the statuses end where they began.
    for (let round = 0; round < MAX_ROUNDS && !settled; round++) {
      const before = await wholesaleListsState(context.container)
      const customers = [...(await activeWholesalers(context.container))]
      wholesalers = customers.length
      repriced = 0
      failed = 0
      for (const [index, customerId] of customers.entries()) {
        const counts = await repriceCustomerCarts(context.container, customerId)
        repriced += counts.repriced
        failed += counts.failed
        await context.progress(Math.min(99, Math.round(((index + 1) / customers.length) * 100)))
      }
      settled = (await wholesaleListsState(context.container)) === before
    }
    if (failed > 0) {
      logger.warn({ event: "wholesale.carts_left_unpriced", failed })
    }
    if (!settled) {
      // The sweep queues the job again (MAX_CARTS_REQUEUES)
      logger.warn({ event: "wholesale.carts_unsettled", rounds: MAX_ROUNDS, attempt })
    }
    logger.info({ event: "wholesale.carts_repriced", wholesalers, repriced, settled })
    return { summary: { wholesalers, repriced, failed, settled, attempt } }
  },
}
