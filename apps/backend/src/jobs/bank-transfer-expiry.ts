import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import {
  BANK_TRANSFER_ORDER_FIELDS,
  MAX_DEADLINE_HOURS,
  bankTransferOf,
  confirmedAt,
  transferDeadline,
} from "../lib/payments/bank-transfer"
import type { BankTransferOrderRow } from "../lib/payments/bank-transfer"
import { expireBankTransferWorkflow } from "../workflows/payments/expire-bank-transfer"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

const HOUR = 60 * 60 * 1000
// The shortest time to pay a shop can set: younger orders are not read at all
const MIN_DEADLINE_MS = HOUR
// The longest, and a margin for the job having been down: older orders are not read either
const WINDOW_MS = (MAX_DEADLINE_HOURS + 7 * 24) * HOUR
const PAGE = 100

type PendingOrder = BankTransferOrderRow & { id: string; display_id: number; created_at: string }

/** Whether the order looks past its time to pay; the workflow checks again under the lock. */
function looksExpired(order: PendingOrder, now: Date): boolean {
  const transfer = bankTransferOf(order)
  if (transfer?.collection.status !== "awaiting" || transfer.captured) {
    return false
  }
  const deadline = transferDeadline(order.created_at, transfer.session)
  return confirmedAt(transfer.session) === null && deadline !== null && deadline <= now
}

async function audit(container: MedusaContainer, order: PendingOrder, deadline: string | null) {
  await container
    .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
    .record({
      kind: "system",
      action: "payments.bank_transfer_expired",
      resource_type: "order",
      resource_id: order.id,
      outcome: 200,
      changes: { display_id: order.display_id, deadline },
    })
    .catch((error: unknown) => {
      logger.warn({ event: "payments.bank_transfer_audit_failed", err: errorSummary(error) })
    })
}

/**
 * Bank transfer orders whose time to pay ran out (F6 W2, adr/0029), each
 * cancelled by `expireBankTransferWorkflow`, which gives its stock back.
 * Pending orders inside the window are read oldest first, page by page
 * from where the last page ended (a cancelled one leaves the list, so
 * offsets would skip). The shopper's notice joins with notifications
 * (F9); the audit log and the log keep the cancel.
 */
export async function expireBankTransfers(
  container: MedusaContainer,
  now = new Date()
): Promise<number> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const until = new Date(now.getTime() - MIN_DEADLINE_MS)
  let from = new Date(now.getTime() - WINDOW_MS)
  let seen = new Set<string>()
  let cancelled = 0
  for (;;) {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "display_id", ...BANK_TRANSFER_ORDER_FIELDS],
      filters: { status: "pending", created_at: { $gte: from, $lte: until } },
      pagination: { take: PAGE, order: { created_at: "ASC", id: "ASC" } },
    })
    const page = (data as unknown as PendingOrder[]).filter((order) => !seen.has(order.id))
    for (const order of page.filter((each) => looksExpired(each, now))) {
      try {
        const { result } = await expireBankTransferWorkflow(container).run({
          input: { order_id: order.id, now: now.toISOString() },
        })
        if (result.expired) {
          cancelled += 1
          await audit(container, order, result.deadline)
        }
      } catch (error) {
        logger.warn({
          event: "payments.bank_transfer_expiry_failed",
          orderId: order.id,
          err: errorSummary(error),
        })
      }
    }
    const last = data.at(-1) as PendingOrder | undefined
    if (data.length < PAGE || !last || page.length === 0) {
      break
    }
    // Orders made in the same millisecond as the last one are read again, then skipped
    from = new Date(last.created_at)
    seen = new Set(
      (data as unknown as PendingOrder[])
        .filter((order) => new Date(order.created_at).getTime() === from.getTime())
        .map((order) => order.id)
    )
  }
  if (cancelled > 0) {
    logger.info({ event: "payments.bank_transfer_expired", cancelled })
  }
  return cancelled
}

export default async function bankTransferExpiry(container: MedusaContainer) {
  await expireBankTransfers(container)
}

export const config = {
  name: "bank-transfer-expiry",
  schedule: "*/15 * * * *",
}
