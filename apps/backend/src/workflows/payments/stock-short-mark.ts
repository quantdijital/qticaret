import type { IOrderModuleService, MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { errorSummary, logger } from "../../lib/logging"
import { ORDER_STOCK_SHORT, STOCK_SHORT_KEY, stockShortOf } from "../../lib/stock"
import type { StockShort, StockShortLine } from "../../lib/stock"
import { raisedUnits } from "../../lib/stock/backorder"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Marks the order with what the shelf lacked (`metadata.stock_short`),
 * once: an order already marked keeps its mark. True when it marked now.
 */
export async function markStockShort(
  container: Container,
  orderId: string,
  short: StockShortLine[]
): Promise<boolean> {
  if (short.length === 0) {
    return false
  }
  const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
  const order = await orders.retrieveOrder(orderId, { select: ["id", "metadata"] })
  if (stockShortOf(order.metadata)) {
    return false
  }
  const mark: StockShort = { lines: short, at: new Date().toISOString() }
  await orders.updateOrders(orderId, {
    metadata: { ...(order.metadata ?? {}), [STOCK_SHORT_KEY]: mark },
  })
  logger.warn({
    event: "payments.order_stock_short",
    orderId,
    units: short.reduce((sum, line) => sum + line.short, 0),
  })
  return true
}

type Amount = unknown

interface OrderRow {
  metadata?: Record<string, unknown> | null
  items?:
    | ({
        id: string
        quantity?: Amount
        variant_id?: string | null
        variant_sku?: string | null
        product_title?: string | null
        variant_title?: string | null
        title?: string | null
      } | null)[]
    | null
}

const amount = (value: Amount) => Number(value ?? 0) || 0

/**
 * An order a crash left unmarked (placed, not yet marked): its
 * reservations against the shelf now, a raise still on a level not
 * counted as stock. Lines held where more is reserved than stocked are
 * short by that much. Marks and tells the shop, once; false when nothing
 * is short or the order is marked already.
 */
export async function markStockShortFromShelf(
  container: Container,
  orderId: string
): Promise<boolean> {
  try {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "metadata",
        "items.id",
        "items.quantity",
        // Medusa fills an item's quantity only with its detail requested
        "items.detail.quantity",
        "items.variant_id",
        "items.variant_sku",
        "items.product_title",
        "items.variant_title",
        "items.title",
      ],
      filters: { id: orderId },
    })
    const order = data[0] as OrderRow | undefined
    const items = (order?.items ?? []).flatMap((item) => (item ? [item] : []))
    if (!order || stockShortOf(order.metadata) || items.length === 0) {
      return false
    }
    const inventory = container.resolve(Modules.INVENTORY)
    const held = await inventory.listReservationItems(
      { line_item_id: items.map((item) => item.id) },
      { select: ["line_item_id", "inventory_item_id", "location_id", "quantity"] }
    )
    const over = new Map<string, number>()
    for (const reservation of held) {
      const key = `${reservation.inventory_item_id}:${reservation.location_id}`
      if (over.has(key)) {
        continue
      }
      const [level] = await inventory.listInventoryLevels(
        { inventory_item_id: reservation.inventory_item_id, location_id: reservation.location_id },
        { take: 1, select: ["stocked_quantity", "reserved_quantity", "metadata"] }
      )
      const stocked = amount(level?.stocked_quantity) - raisedUnits(level?.metadata)
      over.set(key, Math.max(0, amount(level?.reserved_quantity) - stocked))
    }
    const short: StockShortLine[] = []
    for (const item of items) {
      let units = 0
      for (const reservation of held.filter((each) => each.line_item_id === item.id)) {
        const key = `${reservation.inventory_item_id}:${reservation.location_id}`
        const take = Math.min(amount(reservation.quantity), over.get(key) ?? 0)
        over.set(key, (over.get(key) ?? 0) - take)
        const perUnit = amount(reservation.quantity) / Math.max(1, amount(item.quantity))
        units = Math.max(units, Math.ceil(take / Math.max(1, perUnit)))
      }
      if (units > 0 && amount(item.quantity) > 0 && item.variant_id) {
        short.push({
          variant_id: item.variant_id,
          title:
            [item.product_title ?? item.title, item.variant_title].filter(Boolean).join(" / ") ||
            "—",
          sku: item.variant_sku ?? null,
          quantity: amount(item.quantity),
          short: Math.min(units, amount(item.quantity)),
        })
      }
    }
    if (!(await markStockShort(container, orderId, short))) {
      return false
    }
    await container
      .resolve(Modules.EVENT_BUS)
      .emit({ name: ORDER_STOCK_SHORT, data: { id: orderId } })
    return true
  } catch (error) {
    logger.error({
      event: "payments.stock_short_check_failed",
      orderId,
      err: errorSummary(error),
    })
    return false
  }
}
