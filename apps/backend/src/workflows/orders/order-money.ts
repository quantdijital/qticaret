import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { fromMedusaAmount, kurus, subtractKurus, sumKurus } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import {
  itemAmounts,
  lineShares,
  paidForUnits,
  returnRefund,
  shippingAmounts,
} from "../../lib/orders"
import type { LineRefund, LineShare, ReturnedUnits } from "../../lib/orders"
import { ORDER_MONEY_FIELDS, orderFacts } from "./order-facts"
import type { OrderRow } from "./order-facts"

export interface OrderMoneyLine extends LineShare {
  /** Units that came back (received or dismissed on a return); none for shipping. */
  returned: number
  /** What those units paid: the part of the line returns have given back. */
  returned_net: Kurus
}

export interface MoneyTotals {
  gross: Kurus
  discount: Kurus
  net: Kurus
}

export interface OrderMoney extends MoneyTotals {
  currency_code: string
  lines: OrderMoneyLine[]
  /** The items' and the shipping's own totals: price, discount and payment add up in each. */
  items: MoneyTotals
  shipping: MoneyTotals
  /** Taken from the customer, less what was given back: what a refund can still return. */
  paid: Kurus
  refunded: Kurus
  refundable: Kurus
}

const totalsOf = (lines: readonly LineShare[]): MoneyTotals => ({
  gross: sumKurus(lines.map((line) => line.gross)),
  discount: sumKurus(lines.map((line) => line.discount)),
  net: sumKurus(lines.map((line) => line.net)),
})

const kurusOf = (amount: Parameters<typeof fromMedusaAmount>[0]) =>
  fromMedusaAmount(amount, { allowRounding: true })

/**
 * An order's money line by line (F4.7, adr/0010): price, discount share
 * and payment in kuruş, the units given back, and what refunds can still
 * return. Medusa caps a refund at a payment's captures less its refunds,
 * to within a kuruş (its currency epsilon); `refundable` rounds each
 * collection half-up, so it stays inside that cap.
 */
export async function readOrderMoney(
  container: MedusaContainer,
  orderId: string
): Promise<OrderMoney> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order",
    fields: ORDER_MONEY_FIELDS,
    filters: { id: orderId },
  })
  const row = data[0] as OrderRow | undefined
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "orders.unknown")
  }
  const facts = orderFacts(row)
  const shares = lineShares([
    ...facts.items.map(itemAmounts),
    ...facts.shipping.map(shippingAmounts),
  ])
  const returnedOf = new Map(facts.items.map((item) => [item.id, item.returned]))
  const lines = shares.map((share) => {
    const returned = returnedOf.get(share.id) ?? 0
    return { ...share, returned, returned_net: paidForUnits(share, returned) }
  })
  const paid = sumKurus(facts.payments.map((payment) => kurusOf(payment.captured)))
  const refunded = sumKurus(facts.payments.map((payment) => kurusOf(payment.refunded)))
  return {
    currency_code: facts.currency_code,
    lines,
    ...totalsOf(lines),
    items: totalsOf(lines.filter((line) => line.kind === "item")),
    shipping: totalsOf(lines.filter((line) => line.kind === "shipping")),
    paid,
    refunded,
    refundable: kurus(Math.max(subtractKurus(paid, refunded), 0)),
  }
}

/**
 * What giving back `items` returns (F4.7 KK), counted after the units that
 * came back before. Read before the return is received, inside the flow
 * that receives it: Medusa runs an order's changes one at a time, so
 * returns counted so add up to each line's payment. `refundable` is the
 * most a refund may take now; the caller decides what to do when the
 * return asks for more.
 */
export async function returnRefundOf(
  container: MedusaContainer,
  orderId: string,
  items: readonly ReturnedUnits[]
): Promise<{ lines: LineRefund[]; total: Kurus; refundable: Kurus }> {
  const money = await readOrderMoney(container, orderId)
  const refund = returnRefund(
    money.lines,
    new Map(money.lines.map((line) => [line.id, line.returned])),
    items
  )
  return { ...refund, refundable: money.refundable }
}
