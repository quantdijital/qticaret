import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { notificationText } from "../../../lib/notifications/messages"
import { lowStockThresholds } from "../../../lib/stock"
import { STOCK_LEDGER_MODULE } from "../../../modules/stock-ledger"
import type StockLedgerModuleService from "../../../modules/stock-ledger/service"

interface ItemRow {
  id: string
  sku?: string | null
  title?: string | null
  variants?: ({ title?: string | null; product?: { title?: string | null } | null } | null)[] | null
}

async function nameOf(container: MedusaContainer, id: string): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "inventory_item",
    fields: ["id", "sku", "title", "variants.title", "variants.product.title"],
    filters: { id },
  })
  const item = data[0] as ItemRow | undefined
  const variant = item?.variants?.find(Boolean)
  const product = variant?.product?.title
  // The first non-empty: the product and variant, else the item's own title or SKU
  const label = [product, variant?.title].filter(Boolean).join(" · ")
  return [label, item?.title, item?.sku].find((each) => Boolean(each)) ?? id
}

async function sellableOf(container: MedusaContainer, id: string): Promise<number> {
  const levels = await container
    .resolve(Modules.INVENTORY)
    .listInventoryLevels(
      { inventory_item_id: id },
      { select: ["stocked_quantity", "reserved_quantity"] }
    )
  return levels.reduce((sum, level) => sum + level.stocked_quantity - level.reserved_quantity, 0)
}

/** The lock an item's watch is read and written under: one writer at a time makes it. */
export const watchLock = (inventoryItemId: string) => `stock-low:${inventoryItemId}`

/**
 * One item, under its own lock, so two changes at once see each other's
 * result. Above the line it is armed; low and armed, it alerts and is
 * disarmed. The alert's key is its arming: a retry after a failed disarm
 * finds the alert already sent.
 */
async function checkItem(container: MedusaContainer, id: string, threshold: number) {
  const ledger = container.resolve<StockLedgerModuleService>(STOCK_LEDGER_MODULE)
  return container.resolve(Modules.LOCKING).execute(
    watchLock(id),
    async () => {
      const available = await sellableOf(container, id)
      const [watch] = await ledger.listStockWatches({ inventory_item_id: id }, { take: 1 })
      if (available > threshold) {
        if (!watch) {
          await ledger.createStockWatches({ inventory_item_id: id, armed_at: new Date() })
        } else if (!watch.armed_at) {
          await ledger.updateStockWatches({ id: watch.id, armed_at: new Date() })
        }
        return false
      }
      // Never above the line since it last alerted, or since it was made
      if (!watch?.armed_at) {
        return false
      }
      const name = await nameOf(container, id)
      await container.resolve(Modules.NOTIFICATION).createNotifications({
        to: "",
        channel: "feed",
        template: "admin-ui",
        trigger_type: "stock.low",
        resource_id: id,
        idempotency_key: `stock.low:${id}:${new Date(watch.armed_at).toISOString()}`,
        data: {
          kind: "low_stock",
          inventory_item_id: id,
          name,
          available,
          threshold,
          // Medusa's own admin shows these as they are; the panel words the alert from the rest
          ...notificationText("stock.low_stock", { name, available, threshold }),
        },
      })
      await ledger.updateStockWatches({ id: watch.id, armed_at: null })
      return true
    },
    { timeout: 10 }
  )
}

/**
 * Low stock (F3.8 KK, adr/0020): an item whose sellable stock (all
 * locations, less what orders hold) falls from above its threshold to at
 * or under it gets one admin alert (the `feed` channel, read by the
 * panel's bell); it alerts again only after it was above the line again.
 * An item never above it (made with little stock) does not alert.
 *
 * No compensation: each item's state is what was seen, and seeing it again
 * changes nothing.
 */
export const checkLowStockStep = createStep(
  "stock-check-low",
  async (inventoryItemIds: string[], { container }) => {
    const ids = [...new Set(inventoryItemIds)]
    const thresholds = await lowStockThresholds(container, ids)
    const alerted: string[] = []
    for (const id of ids) {
      if (await checkItem(container, id, thresholds.of(id))) {
        alerted.push(id)
      }
    }
    return new StepResponse(alerted)
  }
)
