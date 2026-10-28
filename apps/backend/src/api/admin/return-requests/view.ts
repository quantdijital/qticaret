import { kurus, toMedusaAmount } from "../../../lib/money"

/** A request as staff see it: its refund as exact lira, like every amount the panel reads. */
export const returnRequestView = <T extends { refund_amount: number | null }>(request: T) => ({
  ...request,
  refund_amount:
    request.refund_amount === null ? null : toMedusaAmount(kurus(request.refund_amount)),
})
