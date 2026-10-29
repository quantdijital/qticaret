import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import type { AccountingAdapterId } from "../lib/accounting"
import { isProviderError, isValidationError } from "../lib/errors"
import { errorSummary, logger } from "../lib/logging"
import { notificationText } from "../lib/notifications/messages"
import { ACCOUNTING_MODULE } from "../modules/accounting"
import type AccountingModuleService from "../modules/accounting/service"
import type { ClaimedSync } from "../modules/accounting/service"
import { activeAccountingAdapter } from "../workflows/accounting/active-adapter"
import { recordsBetween } from "../workflows/accounting/queue-records"
import { syncAccountingRecordWorkflow } from "../workflows/accounting/sync-record"

// Records sent per run at most; the next run takes the rest
const BATCH = 50
// A run takes no more after this: inside the five minutes between runs
const RUN_BUDGET_MS = 4 * 60_000
// How far back the hourly sweep looks: a day, and some
const SWEEP_HOURS = 26
const ENQUEUE_CHUNK = 500

const SOURCES: Readonly<Record<ClaimedSync["source_type"], string>> = {
  sale: "satış",
  payment: "tahsilat",
  refund: "iade",
  cancel: "satış iptali",
}

interface Counts {
  synced: number
  skipped: number
  failed: number
  stopped: number
}

/** A code for the record, never a message that may quote data. */
function codeOf(error: unknown): string {
  if (isProviderError(error)) {
    return error.providerCode
  }
  return isValidationError(error) ? error.safeMessage : "error"
}

/** Tells every admin, in the panel's bell, that a record will not be tried again on its own. */
async function alertStopped(container: MedusaContainer, row: ClaimedSync, code: string) {
  await container
    .resolve(Modules.NOTIFICATION)
    .createNotifications({
      to: "",
      channel: "feed",
      template: "admin-ui",
      trigger_type: "accounting.sync_stopped",
      resource_id: row.id,
      data: {
        kind: "accounting_sync",
        source_type: row.source_type,
        code,
        ...notificationText("accounting.sync_stopped", { source: SOURCES[row.source_type] }),
      },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "accounting.alert_failed", err: errorSummary(error) })
    })
}

async function syncOne(
  container: MedusaContainer,
  adapter: AccountingAdapterId,
  row: ClaimedSync,
  at: () => Date,
  counts: Counts
) {
  const records = container.resolve<AccountingModuleService>(ACCOUNTING_MODULE)
  let status: string | null
  try {
    const { result } = await syncAccountingRecordWorkflow(container).run({
      input: {
        adapter,
        sync_id: row.id,
        source_type: row.source_type,
        source_id: row.source_id,
      },
    })
    const done =
      result.skipped !== null
        ? await records.markSkipped(row, result.skipped, at())
        : await records.markSynced(row, result.external_id ?? "", at())
    status = done ? (result.skipped !== null ? "skipped" : "synced") : null
  } catch (error) {
    const code = codeOf(error)
    status = await records.markFailed(row, code, at())
    if (status === "stopped") {
      await alertStopped(container, row, code)
    }
  }
  if (status === null) {
    // Its lease ran out mid-send and another worker has it now: that one decides
    logger.warn({ event: "accounting.claim_lost", sync_id: row.id })
    return
  }
  const key = status === "pending" ? "failed" : (status as keyof Counts)
  counts[key] += 1
}

/**
 * Sends the records due to the shop's accounting program (F11.5, adr/0039
 * §5): each through its workflow; one that fails is tried again later and
 * later, and after the last try it stops and rings the bell (KK2). One at
 * a time, each claimed as it is sent: its lease covers its own send, and a
 * worker whose lease ran out changes nothing.
 */
export async function syncAccounting(container: MedusaContainer, now: Date = new Date()) {
  const counts: Counts = { synced: 0, skipped: 0, failed: 0, stopped: 0 }
  const { id, adapter } = await activeAccountingAdapter(container)
  if (!adapter) {
    return counts
  }
  const records = container.resolve<AccountingModuleService>(ACCOUNTING_MODULE)
  const started = Date.now()
  // The run's clock: `now` moved on by the time the run has taken
  const at = () => new Date(now.getTime() + (Date.now() - started))
  for (let n = 0; n < BATCH && Date.now() - started < RUN_BUDGET_MS; n++) {
    const [row] = await records.claimDue(id, 1, at())
    if (!row) {
      break
    }
    await syncOne(container, id, row, at, counts)
  }
  return counts
}

/**
 * Queues the records of the last day that no event queued (F11.5): never
 * before the program's first record, so what came before the shop picked
 * it is not sent. Those already queued are left alone.
 */
export async function sweepAccounting(container: MedusaContainer, now: Date = new Date()) {
  const { id, adapter } = await activeAccountingAdapter(container)
  if (!adapter) {
    return 0
  }
  const records = container.resolve<AccountingModuleService>(ACCOUNTING_MODULE)
  const first = await records.firstQueuedAt(id)
  if (!first) {
    return 0
  }
  const from = new Date(Math.max(first.getTime(), now.getTime() - SWEEP_HOURS * 3_600_000))
  const found = await recordsBetween(container, from, now)
  let queued = 0
  for (let start = 0; start < found.length; start += ENQUEUE_CHUNK) {
    queued += await records.enqueue(id, found.slice(start, start + ENQUEUE_CHUNK))
  }
  return queued
}

export default async function accountingSync(container: MedusaContainer) {
  const now = new Date()
  // The first run of each hour sweeps for what events missed
  if (now.getUTCMinutes() < 5) {
    try {
      const queued = await sweepAccounting(container, now)
      if (queued > 0) {
        logger.info({ event: "accounting.swept", queued })
      }
    } catch (error) {
      logger.warn({ event: "accounting.sweep_failed", err: errorSummary(error) })
    }
  }
  const counts = await syncAccounting(container, now)
  if (counts.synced + counts.skipped + counts.failed + counts.stopped > 0) {
    logger.info({ event: "accounting.synced", ...counts })
  }
}

export const config = {
  name: "accounting-sync",
  schedule: "*/5 * * * *",
}
