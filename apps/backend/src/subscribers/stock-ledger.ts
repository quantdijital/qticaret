import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../lib/logging"
import { recordStockWorkflow } from "../workflows/stock/ledger"
import type { LevelKey } from "../workflows/stock/steps/record-stock-levels"

type Container = SubscriberArgs["container"]

interface Subject {
  level: LevelKey
  /** The order a reservation was made for; Medusa's reservation events name only the reservation. */
  order_id: string | null
}

async function orderOfLine(container: Container, lineItemId: string | null | undefined) {
  if (!lineItemId) {
    return null
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "order_item",
    fields: ["order_id"],
    filters: { item_id: lineItemId },
    pagination: { take: 1 },
  })
  return (data[0] as { order_id?: string } | undefined)?.order_id ?? null
}

// The level an event is about; a deleted one too (it now holds nothing)
async function subjectOf(container: Container, name: string, id: string): Promise<Subject | null> {
  const inventory = container.resolve(Modules.INVENTORY)
  const config = { take: 1, withDeleted: true }
  if (name.startsWith("inventory-level.")) {
    const [level] = await inventory.listInventoryLevels(
      { id },
      { ...config, select: ["inventory_item_id", "location_id"] }
    )
    return level ? { level: keyOf(level), order_id: null } : null
  }
  const [reservation] = await inventory.listReservationItems(
    { id },
    { ...config, select: ["inventory_item_id", "location_id", "line_item_id"] }
  )
  return reservation
    ? {
        level: keyOf(reservation),
        order_id: await orderOfLine(container, reservation.line_item_id),
      }
    : null
}

const keyOf = (row: LevelKey): LevelKey => ({
  inventory_item_id: row.inventory_item_id,
  location_id: row.location_id,
})

/**
 * Every change to a stock level, by Medusa's own routes and workflows
 * (the stock page, checkout, shipping, returns, cancels), reaches the
 * stock ledger (F3.8, adr/0020) after it is done. A failure never fails
 * the change; the nightly reconcile catches up.
 */
export default async function stockLedger({
  event,
  container,
}: SubscriberArgs<{ id: string; order_id?: string | null }>) {
  try {
    const subject = await subjectOf(container, event.name, event.data.id)
    if (!subject) {
      return
    }
    await recordStockWorkflow(container).run({
      input: { levels: [subject.level], order_id: event.data.order_id ?? subject.order_id },
    })
  } catch (error) {
    logger.warn({ event: "stock.ledger_failed", source: event.name, err: errorSummary(error) })
  }
}

export const config: SubscriberConfig = {
  event: [
    "inventory-level.created",
    "inventory-level.updated",
    "inventory-level.deleted",
    "reservation-item.created",
    "reservation-item.updated",
    "reservation-item.deleted",
  ],
}
