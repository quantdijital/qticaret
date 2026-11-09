import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { planShelfRaise } from "../../../lib/stock/backorder"
import type { ShelfLine, ShelfPlan } from "../../../lib/stock/backorder"
import type { StockShortLine } from "../../../lib/stock"
import { readCartStock } from "../../stock/cart-stock"

export interface BackorderPlan extends ShelfPlan {
  /** What the shelf lacks for the order, for its mark and the shop's alert. */
  short: StockShortLine[]
}

type Amount = number | string | null | undefined

interface ItemsRow {
  items?:
    | ({
        quantity?: Amount
        variant?: {
          manage_inventory?: boolean | null
          allow_backorder?: boolean | null
          inventory_items?:
            | ({
                inventory_item_id: string
                required_quantity?: Amount
                inventory?: {
                  location_levels?:
                    | ({
                        location_id: string
                        stocked_quantity?: Amount
                        reserved_quantity?: Amount
                      } | null)[]
                    | null
                } | null
              } | null)[]
            | null
        } | null
      } | null)[]
    | null
}

const amount = (value: Amount) => Number(value ?? 0) || 0

/**
 * What a paid cart the shelf refused needs to become an order anyway
 * (adr/0026 Ek 2026-11-06): per item, the units its warehouse lacks, and
 * levels to open where the channel keeps none. Reads only. A completed
 * cart needs nothing.
 */
export const planBackorderStep = createStep(
  "payments-plan-backorder",
  async (cartId: string, { container }) => {
    const stock = await readCartStock(container, cartId)
    const none: BackorderPlan = { short: [], levels: [], raises: [] }
    if (stock.completed || stock.tracked.length === 0 || !stock.sales_channel_id) {
      return new StepResponse(none)
    }
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const [{ data: carts }, { data: channels }] = await Promise.all([
      query.graph({
        entity: "cart",
        fields: [
          "items.quantity",
          "items.variant.manage_inventory",
          "items.variant.allow_backorder",
          "items.variant.inventory_items.inventory_item_id",
          "items.variant.inventory_items.required_quantity",
          "items.variant.inventory_items.inventory.location_levels.location_id",
          "items.variant.inventory_items.inventory.location_levels.stocked_quantity",
          "items.variant.inventory_items.inventory.location_levels.reserved_quantity",
        ],
        filters: { id: cartId },
      }),
      query.graph({
        entity: "sales_channel",
        fields: ["stock_locations.id"],
        filters: { id: stock.sales_channel_id },
      }),
    ])
    const locations = (
      (channels[0] as { stock_locations?: ({ id: string } | null)[] | null } | undefined)
        ?.stock_locations ?? []
    ).flatMap((location) => (location ? [location.id] : []))
    const lines: ShelfLine[] = ((carts[0] as ItemsRow | undefined)?.items ?? []).flatMap((item) => {
      const variant = item?.variant
      if (!item || !variant) {
        return []
      }
      return [
        {
          quantity: amount(item.quantity),
          tracked: Boolean(variant.manage_inventory && !variant.allow_backorder),
          links: (variant.inventory_items ?? []).flatMap((link) =>
            link
              ? [
                  {
                    inventory_item_id: link.inventory_item_id,
                    required_quantity: amount(link.required_quantity) || 1,
                    levels: (link.inventory?.location_levels ?? []).flatMap((level) =>
                      level
                        ? [
                            {
                              location_id: level.location_id,
                              stocked: amount(level.stocked_quantity),
                              reserved: amount(level.reserved_quantity),
                            },
                          ]
                        : []
                    ),
                  },
                ]
              : []
          ),
        },
      ]
    })
    return new StepResponse<BackorderPlan>({
      short: stock.short,
      ...planShelfRaise(lines, locations),
    })
  }
)
