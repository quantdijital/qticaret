import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../../lib/logging"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { alertPaymentIssue } from "../payments/issue-alert"
import { refundTraceOf } from "./refund-trace"
import type { TracedRefund } from "./refund-trace"

/** Pending, its money left or may have: counted, the shop told, the job settles it. */
export const REFUND_INCOMPLETE = "refund_incomplete"
/** Pending, PayTR showing nothing yet (its record can lag a lost answer): the job settles it. */
export const REFUND_UNCONFIRMED = "refund_unconfirmed"
/** Refused outright by the provider or before it (`refusedOutright`): nothing was made. */
export const PROVIDER_REFUSED = "provider_refused"
/** Both: an entry the settling job (`jobs/order-refund-settle.ts`) reads again. */
export const UNSETTLED = [REFUND_INCOMPLETE, REFUND_UNCONFIRMED] as const

// Providers with a panel of their own the shop can check a refund in (review D6)
const PANEL_PROVIDERS = new Set(["paytr", "iyzico"])

export interface LedgerEntry {
  id: string
  order_id: string
  reference: string
  payment_id: string
  amount: number
  provider_parts?: unknown
  error_code?: string | null
}

export const ENTRY_FIELDS = [
  "id",
  "order_id",
  "reference",
  "payment_id",
  "amount",
  "provider_parts",
  "error_code",
  "created_at",
  "updated_at",
]

/** An entry as `refundTraceOf` reads it. */
export const tracedOf = (entry: LedgerEntry): TracedRefund => ({
  reference: entry.reference,
  payment_id: entry.payment_id,
  amount: entry.amount,
  parts: (entry.provider_parts as TracedRefund["parts"] | null) ?? [],
})

/**
 * A refund whose workflow failed (review 2026-11-17). Its money left, or
 * may have (recorded, shown, a part sent, nothing readable): kept pending
 * as `refund_incomplete`, its lines counted so no new request gives them
 * back again, and the shop told at a provider with a panel. PayTR showing
 * nothing yet after a lost answer: kept pending as `refund_unconfirmed`,
 * no alert. The settling job closes either, or fails it once PayTR shows
 * nothing twice. Nothing shown after a refusal outright, or elsewhere:
 * nothing sent, `failed`.
 */
export async function settleFailedEntry(
  container: Pick<MedusaContainer, "resolve">,
  entryId: string
): Promise<void> {
  const ledger = container.resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
  const [entry] = await ledger.listOrderRefunds({ id: entryId }, { select: ENTRY_FIELDS })
  if (!entry) {
    return
  }
  const { trace, provider } = await refundTraceOf(container, tracedOf(entry))
  // Nothing shown is proof where nothing lags; nothing shown or readable, where refused outright
  const refused = entry.error_code === PROVIDER_REFUSED && (trace === "none" || trace === "unknown")
  if ((trace === "none" && provider !== "paytr") || refused) {
    await ledger.updateOrderRefunds({ id: entryId, status: "failed", error_code: "refund_failed" })
    return
  }
  const code = trace === "none" ? REFUND_UNCONFIRMED : REFUND_INCOMPLETE
  await ledger.updateOrderRefunds({ id: entryId, status: "pending", error_code: code })
  logger.error({
    event: "orders.refund_unsettled",
    orderId: entry.order_id,
    reference: entry.reference,
    trace,
  })
  if (code === REFUND_INCOMPLETE && PANEL_PROVIDERS.has(provider)) {
    await alertPaymentIssue(container, {
      issue: "refund_incomplete",
      provider,
      reference: entry.reference,
      // The order, in the alert's place for a cart: the shop finds the refund there
      cart_id: entry.order_id,
      amount: entry.amount,
    })
  }
}
