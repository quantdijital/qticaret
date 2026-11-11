import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary } from "@qticaret/server-kit"
import {
  advanceSubscriptionWorkflow,
  startSubscriptionWorkflow,
} from "../../workflows/billing/workflows"
import { billingIn, plansIn, tenantsIn } from "../../workflows/modules"
import { eachBounded } from "../fleet/bounded"
import { reissuePlanDocuments } from "../fleet/reissue"
import type { TenantStatus } from "@qticaret/types/control-plane"
import { istanbulDay, istanbulHour } from "./days"
import { withBillingLock } from "./lock"
import { sendReminders } from "./reminders"
import type { ReminderTally, SendEmail } from "./reminders"
import { REMINDER_HOUR } from "./rules"

type Container = MedusaContainer

const PAGE = 200
const CONCURRENCY = 4

export interface BillingRun {
  today: string
  started: number
  advanced: number
  opened: number
  restricted: number
  released: number
  failed: number
  reminders: ReminderTally | null
}

/** The shop statuses billing still runs for (review L1): not one being closed or closed. */
const BILLED_STATUSES: readonly TenantStatus[] = ["active", "restricted", "suspended"]

async function billedShops(container: Container, ids: string[]): Promise<Set<string>> {
  if (ids.length === 0) {
    return new Set()
  }
  const shops = await tenantsIn(container).listTenants(
    { id: ids, status: [...BILLED_STATUSES] },
    { select: ["id"], take: ids.length }
  )
  return new Set(shops.map((shop) => shop.id))
}

/** Active shops on a package with no subscription yet: theirs starts today. The ids started. */
async function startMissing(container: Container, today: string): Promise<string[]> {
  const plans = await plansIn(container).plansOf({})
  if (plans.size === 0) {
    return []
  }
  const active = await tenantsIn(container).listTenants(
    { id: [...plans.keys()], status: "active" },
    { select: ["id"], take: plans.size }
  )
  const started: string[] = []
  await eachBounded(active, CONCURRENCY, async (tenant) => {
    if (await billingIn(container).subscriptionOf(tenant.id)) {
      return
    }
    const { result } = await startSubscriptionWorkflow(container).run({
      input: { tenant_id: tenant.id, today },
    })
    if (result.created) {
      started.push(tenant.id)
    }
  })
  return started
}

/**
 * One run of billing (adr/0061 §7, Ek C16), for `now` (the clock is the
 * caller's: the job gives the time, a test moves it). Every active shop on
 * a package gets its subscription; every subscription its day (charges,
 * periods, state, restriction, release); every shop whose billing moved
 * its plan document issued again and pushed; from 09:00 Istanbul the
 * day's reminders. Each part may run again the same day without effect.
 * A shop that fails is logged and left to the next run.
 */
export async function runBilling(
  container: Container,
  now: Date,
  options: { send?: SendEmail; reminders?: boolean } = {}
): Promise<BillingRun> {
  const today = istanbulDay(now)
  const logger = container.resolve(ContainerRegistrationKeys.LOGGER)
  const started = await startMissing(container, today)
  const run: BillingRun = {
    today,
    started: started.length,
    advanced: 0,
    opened: 0,
    restricted: 0,
    released: 0,
    failed: 0,
    reminders: null,
  }
  const touched = new Set<string>(started)
  for (let after = ""; ;) {
    const ids = await billingIn(container).subscriptionIds(after, PAGE)
    const subs = await billingIn(container).listSubscriptions(
      { id: ids },
      { select: ["id", "tenant_id"], take: PAGE }
    )
    // Review L1: a shop being closed (or closed) is not billed any more
    const billed = await billedShops(
      container,
      subs.map((sub) => sub.tenant_id)
    )
    await eachBounded(
      subs.filter((sub) => billed.has(sub.tenant_id)),
      CONCURRENCY,
      async (sub) => {
        try {
          // Review M1: one billing decision at a time per shop, whoever takes it
          const { result } = await withBillingLock(container, sub.tenant_id, () =>
            advanceSubscriptionWorkflow(container).run({
              input: { tenant_id: sub.tenant_id, today },
            })
          )
          run.advanced += 1
          run.opened += result.advanced.opened.length
          if (result.move.moved) {
            run[result.move.to === "restricted" ? "restricted" : "released"] += 1
          }
          if (
            result.advanced.opened.length > 0 ||
            result.advanced.status.from !== result.move.status ||
            result.move.moved
          ) {
            touched.add(sub.tenant_id)
          }
        } catch (error) {
          run.failed += 1
          logger.error(
            `cp.billing_advance_failed ${JSON.stringify({ tenant_id: sub.tenant_id, err: errorSummary(error) })}`
          )
        }
      }
    )
    if (ids.length < PAGE) {
      break
    }
    after = ids[ids.length - 1] ?? after
  }
  if (touched.size > 0) {
    // The new state reaches each shop now; the reconcile job covers a failure
    await reissuePlanDocuments(container, [...touched])
  }
  if (options.reminders !== false && istanbulHour(now) >= REMINDER_HOUR) {
    run.reminders = await sendReminders(container, today, options.send)
  }
  return run
}
