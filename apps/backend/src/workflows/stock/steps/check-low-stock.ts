import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { notificationText } from "../../../lib/notifications/messages"
import { alertStaff } from "../../messaging/staff"
import { lowStockThresholds, stockItemLabel } from "../../../lib/stock"
import { STOCK_LEDGER_MODULE } from "../../../modules/stock-ledger"
import type StockLedgerModuleService from "../../../modules/stock-ledger/service"

interface ItemRow {
  id: string
  sku?: string | null
  title?: string | null
  variants?:
    | ({
        id: string
        title?: string | null
        product?: { id: string; title?: string | null } | null
      } | null)[]
    | null
}

/** What the alert names and opens: the product and variant, never the item's id. */
export interface StockSubject {
  name: string
  product_id: string | null
  variant_id: string | null
}

/**
 * The item's product and variant, for the alert's words and link. Null for
 * an item deleted since (the nightly reconcile reads deleted levels too):
 * a product taken off the shop is not "running low".
 */
async function subjectOf(container: MedusaContainer, id: string): Promise<StockSubject | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "inventory_item",
    fields: [
      "id",
      "sku",
      "title",
      "variants.id",
      "variants.title",
      "variants.product.id",
      "variants.product.title",
    ],
    filters: { id },
  })
  const item = data[0] as ItemRow | undefined
  if (!item) {
    return null
  }
  const variant = item.variants?.find((each) => Boolean(each?.product)) ?? null
  return {
    name: stockItemLabel({
      product: variant?.product?.title,
      variant: variant?.title,
      item: item.title,
      sku: item.sku,
    }),
    product_id: variant?.product?.id ?? null,
    variant_id: variant?.id ?? null,
  }
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

// The server's words for an item with no product, title or SKU
const NAMELESS_ITEM = "bir ürün"

/** The lock an item's watch is read and written under: one writer at a time makes it. */
export const watchLock = (inventoryItemId: string) => `stock-low:${inventoryItemId}`

/**
 * One item, under its own lock, so two changes at once see each other's
 * result. Above the line it is armed; low and armed, it alerts and is
 * disarmed. The alert's key is its arming: a retry after a failed disarm
 * finds the alert already sent.
 */
async function checkItem(
  container: MedusaContainer,
  id: string,
  threshold: number
): Promise<{ name: string; available: number; arming: string } | null> {
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
        return null
      }
      // Never above the line since it last alerted, or since it was made
      if (!watch?.armed_at) {
        return null
      }
      const subject = await subjectOf(container, id)
      if (!subject) {
        return null
      }
      const { name } = subject
      const arming = new Date(watch.armed_at).toISOString()
      await container.resolve(Modules.NOTIFICATION).createNotifications({
        to: "",
        channel: "feed",
        template: "admin-ui",
        trigger_type: "stock.low",
        resource_id: id,
        idempotency_key: `stock.low:${id}:${arming}`,
        data: {
          kind: "low_stock",
          inventory_item_id: id,
          ...subject,
          available,
          threshold,
          // Medusa's own admin shows these as they are; the panel words the alert from the rest
          ...notificationText("stock.low_stock", {
            name: name || NAMELESS_ITEM,
            available,
            threshold,
          }),
        },
      })
      await ledger.updateStockWatches({ id: watch.id, armed_at: null })
      return { name: name || NAMELESS_ITEM, available, arming }
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
      const threshold = thresholds.of(id)
      const alert = await checkItem(container, id, threshold)
      if (alert) {
        alerted.push(id)
        // The staff's e-mail too (F9.7), outside the item's lock; it never fails the stock change
        await alertStaff(container, {
          template: "staff.low_stock",
          resource_id: `${id}:${alert.arming}`,
          extra: {
            name: alert.name,
            available: String(alert.available),
            threshold: String(threshold),
          },
        })
      }
    }
    return new StepResponse(alerted)
  }
)
