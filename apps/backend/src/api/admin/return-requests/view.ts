import type { MedusaContainer } from "@medusajs/framework/types"
import { kurus, toMedusaAmount } from "../../../lib/money"
import { refundDueAt } from "../../../lib/orders/withdrawal-rules"
import { withWithdrawalMark } from "../../../workflows/returns/request-items"

/** Kuruş as exact lira, signed: an exchange's difference may be the shop's to pay. */
export const liraOf = (amount: number): string =>
  amount < 0 ? `-${toMedusaAmount(kurus(-amount))}` : toMedusaAmount(kurus(amount))

type When = Date | string | null | undefined

/**
 * A request as staff see it: its refund and an exchange's difference as
 * exact lira; `handed_over_at` as the return carrier's tracking saw it and
 * `refund_due_at`, the law's last day to pay a return back (MSY md. 12/1:
 * 14 days from that handover, else from arrival; adr/0032 Ek 2026-11-03).
 */
export const returnRequestView = <
  T extends {
    kind?: string
    refund_amount: number | null
    difference: number | null
    handed_over_at?: When
    received_at?: When
  },
>(
  request: T
) => ({
  ...request,
  refund_amount: request.refund_amount === null ? null : liraOf(request.refund_amount),
  difference: request.difference === null ? null : liraOf(request.difference),
  refund_due_at: request.kind === "exchange" ? null : (refundDueAt(request)?.toISOString() ?? null),
})

/**
 * A request as an action answers it: as the list shows it, each line
 * marked when it is outside the right of withdrawal.
 */
export const returnRequestDetail = async <
  T extends {
    order_id: string
    items: unknown
    refund_amount: number | null
    difference: number | null
  },
>(
  container: Pick<MedusaContainer, "resolve">,
  request: T
) => returnRequestView(await withWithdrawalMark(container, request))
