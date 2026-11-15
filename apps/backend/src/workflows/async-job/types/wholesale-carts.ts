import { z } from "@medusajs/framework/zod"
import { logger } from "../../../lib/logging"
import { activeWholesalers } from "../../wholesale/accounts/wholesalers"
import { repriceCustomerCarts } from "../../wholesale/steps/carts"
import type { JobContext, JobType } from "./types"

export const WHOLESALE_CARTS_JOB = "wholesale.carts"

export const WholesaleCartsInput = z.object({}).strict()
export type WholesaleCartsInput = z.infer<typeof WholesaleCartsInput>

/**
 * Every open cart of every active wholesaler priced again (security
 * review M2): the flag turned off drafts the wholesale lists, so their
 * carts go to retail; turned on, back to wholesale. A cart that fails
 * twice is counted in the summary, never dropped silently. Queued by the
 * flag's hook only; seen by the owner and admin, as the sync is.
 */
export const wholesaleCarts: JobType<WholesaleCartsInput> = {
  input: WholesaleCartsInput,
  singleton: true,
  internal: true,
  managersOnly: true,
  resultTtlDays: 1,
  containsPersonalData: false,
  execute: async (context: JobContext) => {
    const customers = [...(await activeWholesalers(context.container))]
    let repriced = 0
    let failed = 0
    for (const [index, customerId] of customers.entries()) {
      const counts = await repriceCustomerCarts(context.container, customerId)
      repriced += counts.repriced
      failed += counts.failed
      await context.progress(Math.min(99, Math.round(((index + 1) / customers.length) * 100)))
    }
    if (failed > 0) {
      logger.warn({ event: "wholesale.carts_left_unpriced", failed })
    }
    logger.info({ event: "wholesale.carts_repriced", wholesalers: customers.length, repriced })
    return { summary: { wholesalers: customers.length, repriced, failed } }
  },
}
