import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { paidInTestMode } from "../lib/payments/test-mode"
import { ACCOUNTING_MODULE } from "../modules/accounting"
import type AccountingModuleService from "../modules/accounting/service"
import type { SyncSource } from "../modules/accounting/service"
import { activeAccountingAdapter } from "../workflows/accounting/active-adapter"

type Records = { source_type: SyncSource; source_id: string }[]

/** What an event sends: the order, or each capture or refund of the payment; none paid in test mode. */
async function recordsOf(container: MedusaContainer, event: string, id: string): Promise<Records> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  if (event === "order.placed") {
    const { data } = await query.graph({
      entity: "order",
      fields: ["id", "payment_collections.payments.data"],
      filters: { id },
    })
    const order = data[0] as Parameters<typeof paidInTestMode>[0]
    return order && !paidInTestMode(order) ? [{ source_type: "sale", source_id: id }] : []
  }
  const { data } = await query.graph({
    entity: "payment",
    fields: ["id", "data", "captures.id", "refunds.id"],
    filters: { id },
  })
  const payment = data[0] as
    | {
        data?: Record<string, unknown> | null
        captures?: ({ id: string } | null)[] | null
        refunds?: ({ id: string } | null)[] | null
      }
    | undefined
  if (!payment || payment.data?.["test_mode"] === true) {
    return []
  }
  const [type, moves] =
    event === "payment.captured"
      ? (["payment", payment.captures] as const)
      : (["refund", payment.refunds] as const)
  return (moves ?? []).flatMap((move) => (move ? [{ source_type: type, source_id: move.id }] : []))
}

/**
 * A sale, a payment taken or money given back, queued for the shop's
 * accounting program when it has one (F11.5, adr/0039 §5). Queuing is one
 * insert that a repeated event leaves alone; the order flow never waits on
 * the program, and a failure here is logged, not raised.
 */
export default async function accountingQueue({
  event: { name, data },
  container,
}: SubscriberArgs<{ id: string }>) {
  try {
    const { id, adapter } = await activeAccountingAdapter(container)
    if (!adapter) {
      return
    }
    await container
      .resolve<AccountingModuleService>(ACCOUNTING_MODULE)
      .enqueue(id, await recordsOf(container, name, data.id))
  } catch (error) {
    logger.warn({ event: "accounting.queue_failed", source: name, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = {
  event: ["order.placed", "payment.captured", "payment.refunded"],
}
