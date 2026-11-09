/**
 * The shelf raised for a paid cart's completion (adr/0026 Ek 2026-11-06,
 * security review 2026-11-09). Medusa reserves only what a level has free
 * (stocked − reserved); for a paid cart the shelf lacks, the level is
 * raised by exactly the shortfall, the order placed, and the level
 * lowered by the same amount, leaving the reservation above the shelf.
 * Each raise is marked on its level until it is lowered, so one a crash
 * left behind is found and undone by the sweeper.
 */

/** The level's metadata key holding the raises not yet lowered. */
export const BACKORDER_MARK = "qt_backorder_adjust"

/** How long a raise may stand before the sweeper takes it back. */
export const BACKORDER_RAISE_TTL_MS = 5 * 60 * 1000

export interface ShelfRaise {
  inventory_item_id: string
  location_id: string
  quantity: number
}

export interface BackorderMarkEntry {
  cart_id: string
  quantity: number
  /** ISO time after which the sweeper lowers it. */
  expires_at: string
}

export interface ShelfLine {
  quantity: number
  /** Tracked and not sold past the shelf: the only lines Medusa checks. */
  tracked: boolean
  links: {
    inventory_item_id: string
    required_quantity: number
    levels: { location_id: string; stocked: number; reserved: number }[]
  }[]
}

export interface ShelfPlan {
  /** Levels to open at 0 first: items no warehouse of the channel keeps. */
  levels: { inventory_item_id: string; location_id: string; stocked_quantity: number }[]
  raises: ShelfRaise[]
}

/**
 * Per inventory item, the units the cart's tracked lines need against the
 * channel's warehouses. Where one has them free, nothing; otherwise the
 * level with the most free is raised by what it lacks (an item with no
 * level there gets one at the channel's first warehouse, raised whole).
 */
export function planShelfRaise(
  lines: readonly ShelfLine[],
  locations: readonly string[]
): ShelfPlan {
  const first = locations[0]
  const needs = new Map<string, { need: number; levels: ShelfLine["links"][number]["levels"] }>()
  for (const line of lines) {
    if (!line.tracked) {
      continue
    }
    for (const link of line.links) {
      const known = needs.get(link.inventory_item_id)
      needs.set(link.inventory_item_id, {
        need: (known?.need ?? 0) + Math.max(1, link.required_quantity) * line.quantity,
        levels: link.levels.filter((level) => locations.includes(level.location_id)),
      })
    }
  }
  const plan: ShelfPlan = { levels: [], raises: [] }
  for (const [itemId, { need, levels }] of needs) {
    const best = [...levels].sort((a, b) => b.stocked - b.reserved - (a.stocked - a.reserved))[0]
    if (!best) {
      if (first && need > 0) {
        plan.levels.push({ inventory_item_id: itemId, location_id: first, stocked_quantity: 0 })
        plan.raises.push({ inventory_item_id: itemId, location_id: first, quantity: need })
      }
      continue
    }
    const lacking = need - Math.max(0, best.stocked - best.reserved)
    if (lacking > 0) {
      plan.raises.push({
        inventory_item_id: itemId,
        location_id: best.location_id,
        quantity: lacking,
      })
    }
  }
  return plan
}

const isEntry = (value: unknown): value is BackorderMarkEntry => {
  const entry = value as Partial<BackorderMarkEntry> | null
  return (
    typeof entry === "object" &&
    entry !== null &&
    typeof entry.cart_id === "string" &&
    typeof entry.quantity === "number" &&
    entry.quantity > 0 &&
    typeof entry.expires_at === "string"
  )
}

/** The raises a level still holds, read defensively. */
export function markEntriesOf(metadata: Record<string, unknown> | null | undefined) {
  const value = metadata?.[BACKORDER_MARK]
  return Array.isArray(value) ? value.filter(isEntry) : []
}

/**
 * The level's metadata with `entries` as its raises. Medusa merges a
 * metadata update into what is stored and drops a key sent as "" (2.21.2):
 * with none left, the key goes as "" so it is taken off.
 */
export function withMarkEntries(
  metadata: Record<string, unknown> | null | undefined,
  entries: readonly BackorderMarkEntry[]
): Record<string, unknown> {
  return { ...(metadata ?? {}), [BACKORDER_MARK]: entries.length > 0 ? [...entries] : "" }
}

/** The units of a level that are a raise, not stock. */
export const raisedUnits = (metadata: Record<string, unknown> | null | undefined): number =>
  markEntriesOf(metadata).reduce((sum, entry) => sum + entry.quantity, 0)
