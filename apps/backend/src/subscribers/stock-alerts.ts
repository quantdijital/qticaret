import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { Modules } from "@medusajs/framework/utils"
import { notifyStockAlertsSafely, variantsOfItem } from "../workflows/stock/stock-alerts"

/**
 * Stock that comes in (a level raised, a reservation let go) tells the
 * customers waiting for its variants, once each (F10.5, KK2).
 */
export default async function stockAlerts({ event, container }: SubscriberArgs<{ id: string }>) {
  const inventory = container.resolve(Modules.INVENTORY)
  const config = { take: 1, withDeleted: true, select: ["inventory_item_id"] }
  const [row] = event.name.startsWith("inventory-level.")
    ? await inventory.listInventoryLevels({ id: event.data.id }, config)
    : await inventory.listReservationItems({ id: event.data.id }, config)
  if (!row) {
    return
  }
  await notifyStockAlertsSafely(container, await variantsOfItem(container, row.inventory_item_id))
}

export const config: SubscriberConfig = {
  event: [
    "inventory-level.created",
    "inventory-level.updated",
    "reservation-item.updated",
    "reservation-item.deleted",
  ],
}
