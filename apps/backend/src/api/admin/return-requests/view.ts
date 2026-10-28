import { kurus, toMedusaAmount } from "../../../lib/money"

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
