import type { OrderMoney, RefundRequest } from "@/features/orders/api/orders"
import { parseMoneyInput } from "@/lib/money-input"

/** How a refund is chosen: units of lines (and the shipping), or a free amount. */
export type RefundMode = "items" | "amount"

/** Units a line can still give back: what it holds less what refunds gave back. */
export const refundableUnits = (line: OrderMoney["lines"][number]): number =>
  Math.max(line.quantity - line.refunded_units, 0)

/** The shipping lines' remainder, in lira. */
export const shippingLeft = (money: OrderMoney): number =>
  money.lines
    .filter((line) => line.kind === "shipping")
    .reduce((sum, line) => sum + Math.max(Number(line.net) - Number(line.refunded_net), 0), 0)

/** The request for what is chosen; null while nothing is. */
export function refundRequest(
  mode: RefundMode,
  quantities: Readonly<Record<string, number>>,
  shipping: boolean,
  amountText: string
): RefundRequest | null {
  if (mode === "amount") {
    const amount = parseMoneyInput(amountText)
    return amount !== null && amount > 0 ? { amount } : null
  }
  const items = Object.entries(quantities)
    .filter(([, quantity]) => quantity > 0)
    .map(([id, quantity]) => ({ id, quantity }))
  if (items.length === 0 && !shipping) {
    return null
  }
  return { ...(items.length > 0 ? { items } : {}), ...(shipping ? { shipping } : {}) }
}

/** A refund's own key, made once per dialog: tried again, the refund happens once. */
export const newRefundReference = (): string => crypto.randomUUID().replaceAll("-", "")
