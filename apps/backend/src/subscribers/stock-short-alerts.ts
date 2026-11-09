import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ORDER_STOCK_SHORT } from "../lib/stock"
import { alertStockShort } from "../workflows/stock/stock-short-alert"

/** A paid order placed short of stock: the shop hears of it (adr/0026 Ek 2026-11-06). */
export default async function stockShortAlerts({
  event: { data },
  container,
}: SubscriberArgs<{ id: string }>) {
  await alertStockShort(container, data.id)
}

export const config: SubscriberConfig = { event: ORDER_STOCK_SHORT }
