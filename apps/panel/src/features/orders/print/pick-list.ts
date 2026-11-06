import type { PackingAddon, PackingOrder } from "@/features/orders/api/packing"

/** One order's share of a pick list row: how many, and what its line asks to be made. */
export interface PickEntry {
  orderId: string
  displayId: number
  quantity: number
  addons: PackingAddon[]
}

/** A product to take off the shelf: its units across the orders, each order's line beside it. */
export interface PickRow {
  key: string
  title: string
  variant: string | null
  sku: string | null
  quantity: number
  entries: PickEntry[]
}

/**
 * The picked orders' lines gathered by product (SKU, or name and variant
 * where there is none), by name: one walk along the shelves, with each
 * product's units summed, then the orders' own lines with their add-on texts
 * (adr/0052 §9) to make or to pack by. Lines that go in no box are left out.
 */
export function pickList(orders: readonly PackingOrder[]): PickRow[] {
  const rows = new Map<string, PickRow>()
  for (const order of orders) {
    for (const item of order.items) {
      if (!item.ships) {
        continue
      }
      const key = item.sku ?? `${item.title}\u0000${item.variant ?? ""}`
      const row = rows.get(key) ?? {
        key,
        title: item.title,
        variant: item.variant,
        sku: item.sku,
        quantity: 0,
        entries: [],
      }
      row.quantity += item.quantity
      row.entries.push({
        orderId: order.id,
        displayId: order.display_id,
        quantity: item.quantity,
        addons: item.addons,
      })
      rows.set(key, row)
    }
  }
  return [...rows.values()].sort(
    (a, b) =>
      a.title.localeCompare(b.title, "tr") || (a.variant ?? "").localeCompare(b.variant ?? "", "tr")
  )
}
