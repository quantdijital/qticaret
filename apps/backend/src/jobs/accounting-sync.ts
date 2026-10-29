import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { isProviderError, isValidationError } from "../lib/errors"
import { errorSummary, logger } from "../lib/logging"
import { notificationText } from "../lib/notifications/messages"
import { ACCOUNTING_MODULE } from "../modules/accounting"
import type AccountingModuleService from "../modules/accounting/service"
import type { ClaimedSync } from "../modules/accounting/service"
import { activeAccountingAdapter } from "../workflows/accounting/active-adapter"
import { syncAccountingRecordWorkflow } from "../workflows/accounting/sync-record"

// Records sent per run; the next run takes the rest
const BATCH = 50

const SOURCES: Readonly<Record<ClaimedSync["source_type"], string>> = {
  sale: "satış",
  payment: "tahsilat",
  refund: "iade",
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

/**
 * Sends the records due to the shop's accounting program (F11.5, adr/0039
 * §5): each through its workflow; one that fails is tried again later and
 * later, and after the last try it stops and rings the bell (KK2).
 */
export async function syncAccounting(container: MedusaContainer, now: Date = new Date()) {
  const counts = { synced: 0, failed: 0, stopped: 0 }
  const { id, adapter } = await activeAccountingAdapter(container)
  if (!adapter) {
    return counts
  }
  const records = container.resolve<AccountingModuleService>(ACCOUNTING_MODULE)
  for (const row of await records.claimDue(id, BATCH, now)) {
    try {
      const { result } = await syncAccountingRecordWorkflow(container).run({
        input: {
          adapter: id,
          sync_id: row.id,
          source_type: row.source_type,
          source_id: row.source_id,
        },
      })
      await records.markSynced(row.id, result.external_id, now)
      counts.synced += 1
    } catch (error) {
      const code = codeOf(error)
      const status = await records.markFailed(row.id, row.attempts, code, now)
      counts[status === "stopped" ? "stopped" : "failed"] += 1
      if (status === "stopped") {
        await alertStopped(container, row, code)
      }
    }
  }
  return counts
}

export default async function accountingSync(container: MedusaContainer) {
  const counts = await syncAccounting(container)
  if (counts.synced + counts.failed + counts.stopped > 0) {
    logger.info({ event: "accounting.synced", ...counts })
  }
}

export const config = {
  name: "accounting-sync",
  schedule: "*/5 * * * *",
}
