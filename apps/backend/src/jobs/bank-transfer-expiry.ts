import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { cancelOrderWorkflow } from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../lib/logging"
import { BANK_TRANSFER_PAYMENT_PROVIDER_ID } from "../lib/payments/checkout"
import { AUDIT_LOG_MODULE } from "../modules/audit-log"
import type AuditLogModuleService from "../modules/audit-log/service"

const HOUR = 60 * 60 * 1000
// The shortest time to pay a shop can set: younger orders are not read at all
const MIN_DEADLINE_MS = HOUR
const PAGE = 100

interface AwaitingOrder {
  id: string
  display_id: number
  created_at: string | Date
  payment_collections?:
    | ({
        status?: string | null
        payment_sessions?:
          ({ provider_id: string; data?: Record<string, unknown> | null } | null)[] | null
      } | null)[]
    | null
}

/** When the order's time to pay ran out: its own session's hours, as the shopper was told. */
export function transferDeadline(order: AwaitingOrder): Date | null {
  const collection = (order.payment_collections ?? []).find((each) => each?.status === "awaiting")
  const session = collection?.payment_sessions?.find(
    (each) => each?.provider_id === BANK_TRANSFER_PAYMENT_PROVIDER_ID
  )
  const hours = session?.data?.["deadline_hours"]
  return typeof hours === "number"
    ? new Date(new Date(order.created_at).getTime() + hours * HOUR)
    : null
}

/**
 * Bank transfer orders whose time to pay ran out (F6 W2, adr/0029): each
 * is cancelled through Medusa's own cancel, which gives its stock back.
 * The shopper's notice joins with notifications (F9); the audit log and
 * the log keep the cancel.
 */
export async function expireBankTransfers(
  container: MedusaContainer,
  now = new Date()
): Promise<number> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  let cancelled = 0
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "order",
      fields: [
        "id",
        "display_id",
        "created_at",
        "payment_collections.status",
        "payment_collections.payment_sessions.provider_id",
        "payment_collections.payment_sessions.data",
      ],
      filters: {
        status: "pending",
        created_at: { $lte: new Date(now.getTime() - MIN_DEADLINE_MS) },
      },
      pagination: { skip, take: PAGE, order: { created_at: "ASC" } },
    })
    for (const order of data as unknown as AwaitingOrder[]) {
      const deadline = transferDeadline(order)
      if (!deadline || deadline > now) {
        continue
      }
      try {
        await cancelOrderWorkflow(container).run({ input: { order_id: order.id } })
        cancelled += 1
        await container
          .resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
          .record({
            kind: "system",
            action: "payments.bank_transfer_expired",
            resource_type: "order",
            resource_id: order.id,
            outcome: 200,
            changes: { display_id: order.display_id, deadline: deadline.toISOString() },
          })
          .catch((error: unknown) => {
            logger.warn({ event: "payments.bank_transfer_audit_failed", err: errorSummary(error) })
          })
      } catch (error) {
        logger.warn({
          event: "payments.bank_transfer_expiry_failed",
          orderId: order.id,
          err: errorSummary(error),
        })
      }
    }
    if (data.length < PAGE) {
      break
    }
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
