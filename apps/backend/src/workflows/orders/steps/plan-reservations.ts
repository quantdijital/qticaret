import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { nothingToFill, planReservationFill } from "../../../lib/shipping/reservations"
import type { FillLine, ReservationFill } from "../../../lib/shipping/reservations"

export interface PlanReservationsInput {
  order_id: string
  /** The parcel's lines and units. */
  items: { id: string; quantity: number }[]
  /** The warehouse the parcel leaves from (`planCarrierStep`). */
  location_id: string
}

interface OrderRow {
  items?: ({ id: string; variant?: FillLine["variant"] } | null)[] | null
}

/**
 * Reads what the parcel's tracked lines hold and what the warehouse has a
 * level for, and plans what is missing (`lib/shipping/reservations`). Reads
 * only: the fill workflow makes the plan with Medusa's own workflows.
 */
export const planReservationsStep = createStep(
  "orders-plan-reservations",
  async (input: PlanReservationsInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "order",
      fields: [
        "items.id",
        "items.variant.manage_inventory",
        "items.variant.inventory_items.inventory_item_id",
        "items.variant.inventory_items.required_quantity",
      ],
      filters: { id: input.order_id },
    })
    const wanted = new Map(input.items.map((item) => [item.id, item.quantity]))
    const lines: FillLine[] = ((data[0] as OrderRow | undefined)?.items ?? []).flatMap((item) =>
      item && wanted.has(item.id)
        ? [{ id: item.id, quantity: wanted.get(item.id) ?? 0, variant: item.variant ?? null }]
        : []
    )
    const itemIds = [
      ...new Set(
        lines.flatMap((line) =>
          line.variant?.manage_inventory
            ? (line.variant.inventory_items ?? []).flatMap((link) =>
                link ? [link.inventory_item_id] : []
              )
            : []
        )
      ),
    ]
    if (itemIds.length === 0) {
      return new StepResponse<ReservationFill>(nothingToFill(input.location_id))
    }
    const inventory = container.resolve(Modules.INVENTORY)
    const [held, levels] = await Promise.all([
      inventory.listReservationItems(
        { line_item_id: lines.map((line) => line.id) },
        { select: ["id", "line_item_id", "inventory_item_id", "quantity"] }
      ),
      inventory.listInventoryLevels(
        { inventory_item_id: itemIds, location_id: input.location_id },
        { select: ["inventory_item_id", "stocked_quantity"] }
      ),
    ])
    return new StepResponse<ReservationFill>(
      planReservationFill({
        location_id: input.location_id,
        lines,
        held: held.map((row) => ({
          id: row.id,
          line_item_id: row.line_item_id ?? null,
          inventory_item_id: row.inventory_item_id,
          quantity: Number(row.quantity),
        })),
        levels,
      })
    )
  }
)
