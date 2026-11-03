import type { MedusaContainer } from "@medusajs/framework/types"
import { kurus, toMedusaAmount } from "../../../lib/money"
import { withWithdrawalMark } from "../../../workflows/returns/request-items"

/** Kuruş as exact lira, signed: an exchange's difference may be the shop's to pay. */
export const liraOf = (amount: number): string =>
  amount < 0 ? `-${toMedusaAmount(kurus(-amount))}` : toMedusaAmount(kurus(amount))

/** A request as staff see it: its refund and an exchange's difference as exact lira. */
export const returnRequestView = <
  T extends { refund_amount: number | null; difference: number | null },
>(
  request: T
) => ({
  ...request,
  refund_amount: request.refund_amount === null ? null : liraOf(request.refund_amount),
  difference: request.difference === null ? null : liraOf(request.difference),
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
