import type {
  IOrderModuleService,
  IProductModuleService,
  MedusaContainer,
} from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { STOCK_SHORT_KEY } from "../../../lib/stock"
import type { StockShort, StockShortLine } from "../../../lib/stock"
import { readCartStock } from "../../stock/cart-stock"

export interface BackorderPlan {
  /** Tracked variants of the cart, sold past the shelf for the completion only. */
  variant_ids: string[]
  /** What the shelf lacks for the order, for its mark and the shop's alert. */
  short: StockShortLine[]
  /** Levels at 0 for items the channel's warehouses keep none of (Medusa reserves only at a level). */
  levels: { inventory_item_id: string; location_id: string; stocked_quantity: number }[]
}

interface ItemsRow {
  items?:
    | ({
        variant?: {
          manage_inventory?: boolean | null
          allow_backorder?: boolean | null
          inventory_items?:
            | ({
                inventory_item_id: string
                inventory?: { location_levels?: ({ location_id: string } | null)[] | null } | null
              } | null)[]
            | null
        } | null
      } | null)[]
    | null
}

/**
 * What a paid cart the shelf refused needs to become an order anyway
 * (adr/0026 Ek 2026-11-06). Reads only. A completed cart needs nothing.
 */
export const planBackorderStep = createStep(
  "payments-plan-backorder",
  async (cartId: string, { container }) => {
    const stock = await readCartStock(container, cartId)
    if (stock.completed || stock.tracked.length === 0) {
      return new StepResponse<BackorderPlan>({ variant_ids: [], short: [], levels: [] })
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const [{ data: carts }, { data: channels }] = await Promise.all([
      query.graph({
        entity: "cart",
        fields: [
          "items.variant.manage_inventory",
          "items.variant.allow_backorder",
          "items.variant.inventory_items.inventory_item_id",
          "items.variant.inventory_items.inventory.location_levels.location_id",
        ],
        filters: { id: cartId },
      }),
      query.graph({
        entity: "sales_channel",
        fields: ["stock_locations.id"],
        filters: { id: stock.sales_channel_id ?? "" },
      }),
    ])
    const locations = (
      (channels[0] as { stock_locations?: ({ id: string } | null)[] | null } | undefined)
        ?.stock_locations ?? []
    ).flatMap((location) => (location ? [location.id] : []))
    const first = locations[0]
    const levels = new Map<string, BackorderPlan["levels"][number]>()
    for (const item of (carts[0] as ItemsRow | undefined)?.items ?? []) {
      const variant = item?.variant
      if (!first || !variant?.manage_inventory || variant.allow_backorder) {
        continue
      }
      for (const link of variant.inventory_items ?? []) {
        const kept = (link?.inventory?.location_levels ?? []).some(
          (level) => level !== null && locations.includes(level.location_id)
        )
        if (link && !kept) {
          levels.set(link.inventory_item_id, {
            inventory_item_id: link.inventory_item_id,
            location_id: first,
            stocked_quantity: 0,
          })
        }
      }
    }
    return new StepResponse<BackorderPlan>({
      variant_ids: stock.tracked,
      short: stock.short,
      levels: [...levels.values()],
    })
  }
)

const setBackorder = (container: Pick<MedusaContainer, "resolve">, ids: string[], allow: boolean) =>
  container
    .resolve<IProductModuleService>(Modules.PRODUCT)
    .updateProductVariants({ id: ids }, { allow_backorder: allow })

/**
 * Lets Medusa's completion reserve past the shelf for these variants: its
 * reservation skips the stock check for a variant that allows backorder
 * (core-flows `prepareConfirmInventoryInput` → inventory module
 * `createReservationItems`). Put back if the completion fails.
 */
export const allowBackorderStep = createStep(
  "payments-allow-backorder",
  async (ids: string[], { container }) => {
    if (ids.length > 0) {
      await setBackorder(container, ids, true)
    }
    return new StepResponse(ids, ids)
  },
  async (ids, { container }) => {
    if (ids && ids.length > 0) {
      await setBackorder(container, ids, false)
    }
  }
)

/**
 * Puts the variants back once the order is placed. Never fails: the order
 * stands either way; a variant left selling past the shelf is logged as
 * an error for the shop to see to.
 */
export const restoreBackorderStep = createStep(
  "payments-restore-backorder",
  async (ids: string[], { container }) => {
    if (ids.length === 0) {
      return new StepResponse(false)
    }
    try {
      await setBackorder(container, ids, false)
      return new StepResponse(true)
    } catch (error) {
      logger.error({
        event: "payments.backorder_restore_failed",
        variantIds: ids,
        err: errorSummary(error),
      })
      return new StepResponse(false)
    }
  }
)

/**
 * Marks the order with what the shelf lacked (`metadata.stock_short`).
 * Never fails: the order is placed and paid; without the mark the shop
 * still has the e-mail of the order itself.
 */
export const markStockShortStep = createStep(
  "payments-mark-stock-short",
  async (input: { order_id: string; short: StockShortLine[] }, { container }) => {
    if (input.short.length === 0) {
      return new StepResponse(false)
    }
    try {
      const orders = container.resolve<IOrderModuleService>(Modules.ORDER)
      const order = await orders.retrieveOrder(input.order_id, { select: ["id", "metadata"] })
      const mark: StockShort = { lines: input.short, at: new Date().toISOString() }
      await orders.updateOrders(input.order_id, {
        metadata: { ...(order.metadata ?? {}), [STOCK_SHORT_KEY]: mark },
      })
      logger.warn({
        event: "payments.order_stock_short",
        orderId: input.order_id,
        units: input.short.reduce((sum, line) => sum + line.short, 0),
      })
      return new StepResponse(true)
    } catch (error) {
      logger.error({
        event: "payments.stock_short_mark_failed",
        orderId: input.order_id,
        err: errorSummary(error),
      })
      return new StepResponse(false)
    }
  }
)
