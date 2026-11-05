/**
 * What "Kargoya ver" holds before Medusa packs a parcel (adr/0054,
 * 2026-11-05 addendum). Medusa's packing (`createOrderFulfillmentWorkflow`)
 * takes each tracked line's units out of its stock reservation and refuses
 * a line with none, or with fewer than the parcel holds; it then takes the
 * units off the warehouse's level, which must exist. An order can reach
 * shipping without them: a variant whose stock tracking was turned on after
 * the order, a reservation deleted or cut down in Medusa's admin, a kit
 * component whose reservation is gone. That is our bookkeeping, not a
 * reason to keep a parcel that is in hand: what is missing is made here,
 * and Medusa's packing consumes it in the same run.
 *
 * Untracked variants (`manage_inventory: false`) are left alone. A line
 * whose item is held in several reservations keeps Medusa's own rule.
 */

export interface FillLine {
  /** The order's line item. */
  id: string
  /** Units of it in this parcel. */
  quantity: number
  variant?: {
    manage_inventory?: boolean | null
    inventory_items?:
      ({ inventory_item_id: string; required_quantity?: number | null } | null)[] | null
  } | null
}

/** A reservation the order's lines already have, wherever it is held. */
export interface HeldStock {
  id: string
  line_item_id?: string | null
  inventory_item_id: string
  quantity: number | string
}

/** The shipping warehouse's level for an item. */
export interface ShelfLevel {
  inventory_item_id: string
  stocked_quantity: number | string
}

export interface FilledLine {
  line_item_id: string
  inventory_item_id: string
  /** `created`: nothing was held; `raised`: less than the parcel was. */
  kind: "created" | "raised"
  /** Units added to the hold. */
  quantity: number
  /** Units the warehouse's count did not have: once shipped, the count is this far below zero. */
  past_count: number
}

export interface ReservationFill {
  location_id: string
  /** Levels the warehouse lacks, made at 0: the parcel exists, the count follows it. */
  levels: { inventory_item_id: string; location_id: string; stocked_quantity: number }[]
  create: {
    line_item_id: string
    inventory_item_id: string
    location_id: string
    quantity: number
    allow_backorder: boolean
    metadata: Record<string, unknown>
  }[]
  raise: { id: string; quantity: number; allow_backorder: boolean }[]
  lines: FilledLine[]
}

/** Marks a reservation "Kargoya ver" made; packing consumes it at once. */
export const FILLED_BY = "orders-ship-order"

export const nothingToFill = (locationId: string): ReservationFill => ({
  location_id: locationId,
  levels: [],
  create: [],
  raise: [],
  lines: [],
})

const amount = (value: number | string | null | undefined): number => {
  const number = Number(value ?? 0)
  return Number.isFinite(number) ? number : 0
}

/**
 * The levels and holds the parcel's tracked lines lack at the shipping
 * warehouse. Each line's item needs `quantity × required_quantity` held,
 * as Medusa's packing counts it. The holds skip Medusa's availability
 * check (`allow_backorder`): it guards a sale, and this parcel is already
 * sold and packed. The variant's own selling rule (`allow_backorder`, the
 * `stock.preorder` gate) is not touched; the storefront still sells only
 * what the count has. Pure: the caller reads, this decides.
 */
export function planReservationFill(input: {
  location_id: string
  lines: readonly FillLine[]
  held: readonly HeldStock[]
  levels: readonly ShelfLevel[]
}): ReservationFill {
  const fill = nothingToFill(input.location_id)
  const shelf = new Map(
    input.levels.map((level) => [level.inventory_item_id, amount(level.stocked_quantity)])
  )
  for (const line of input.lines) {
    if (!line.variant?.manage_inventory || line.quantity <= 0) {
      continue
    }
    for (const link of line.variant.inventory_items ?? []) {
      if (!link) {
        continue
      }
      const itemId = link.inventory_item_id
      const needed = line.quantity * (amount(link.required_quantity) || 1)
      if (!shelf.has(itemId)) {
        fill.levels.push({
          inventory_item_id: itemId,
          location_id: input.location_id,
          stocked_quantity: 0,
        })
        shelf.set(itemId, 0)
      }
      // The whole parcel leaves the shelf, held before or not
      const onShelf = shelf.get(itemId) ?? 0
      shelf.set(itemId, onShelf - needed)
      const own = input.held.filter(
        (held) => held.line_item_id === line.id && held.inventory_item_id === itemId
      )
      const current = own.length === 1 ? amount(own[0]?.quantity) : 0
      if (own.length > 1 || current >= needed) {
        continue
      }
      const reservation = own[0]
      if (reservation) {
        fill.raise.push({ id: reservation.id, quantity: needed, allow_backorder: true })
      } else {
        fill.create.push({
          line_item_id: line.id,
          inventory_item_id: itemId,
          location_id: input.location_id,
          quantity: needed,
          allow_backorder: true,
          metadata: { filled_by: FILLED_BY },
        })
      }
      fill.lines.push({
        line_item_id: line.id,
        inventory_item_id: itemId,
        kind: reservation ? "raised" : "created",
        quantity: needed - current,
        past_count: Math.max(0, needed - Math.max(0, onShelf)),
      })
    }
  }
  return fill
}
