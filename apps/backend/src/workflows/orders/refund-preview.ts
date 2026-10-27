import type { MedusaContainer } from "@medusajs/framework/types"
import { kurus } from "../../lib/money"
import { planRefund } from "../../lib/orders"
import type { RefundRequest } from "../../lib/orders"
import { ORDER_REFUNDS_MODULE } from "../../modules/order-refunds"
import type OrderRefundsModuleService from "../../modules/order-refunds/service"
import { readOrderMoney } from "./order-money"

/** What a refund would give back, line by line, before it is made: reads only. */
export async function previewOrderRefund(
  container: MedusaContainer,
  orderId: string,
  request: RefundRequest
) {
  const money = await readOrderMoney(container, orderId)
  const refunded = await container
    .resolve<OrderRefundsModuleService>(ORDER_REFUNDS_MODULE)
    .refundedLines(orderId)
  return {
    ...planRefund(money.lines, refunded, request, money.refundable),
    refundable: money.refundable,
  }
}

/** Lira as the request sent it, in kuruş. */
export const kurusOfLira = (value: number) => kurus(Math.round(value * 100))
