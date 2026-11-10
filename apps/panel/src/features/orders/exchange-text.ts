import type { TFunction } from "i18next"
import { formatMoney } from "@qticaret/admin-ui/lib/format"

const R = "orders.returns"

/** What the swap costs, in words: who owes whom how much. */
export function differenceText(t: TFunction, difference: string | null): string {
  const amount = Number(difference ?? 0)
  if (amount === 0) {
    return t(`${R}.exchange.even`)
  }
  const money = formatMoney(Math.abs(amount), "try")
  return amount > 0
    ? t(`${R}.exchange.shopperOwes`, { amount: money })
    : t(`${R}.exchange.shopOwes`, { amount: money })
}
