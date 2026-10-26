import type { LevelAdjustment, LevelQuantity } from "../../stock/write-levels"
import { MAX_QUANTITY } from "./change"
import type { BulkChange } from "./change"
import { UNCHANGED, skipped, writing } from "./plan-result"
import type { BulkDiff, BulkPlan } from "./plan-result"
import type { BulkProduct } from "./products"

/**
 * Stock at the default warehouse (F3.10, adr/0020), for variants whose
 * stock is kept on one inventory item (a kit's several items are left as
 * they are). `set` writes the quantity; `adjust` moves a level by the
 * number, under the item's lock as Medusa's own adjustments do, so a sale
 * between the read and the write is not undone. A level the item lacks is
 * made. A product one of whose levels would go below zero is left whole.
 */
export function planStock(
  product: BulkProduct,
  change: Extract<BulkChange, { action: "stock" }>,
  locationId: string
): BulkPlan {
  const variants = product.variants ?? []
  const create: LevelQuantity[] = []
  const update: LevelQuantity[] = []
  const adjust: LevelAdjustment[] = []
  const diff: BulkDiff = {}
  const seen = new Set<string>()
  let untracked = 0
  for (const variant of variants) {
    // One item, one unit of it per variant: a kit's components are not this change's
    const items = variant.inventory_items ?? []
    const item =
      items.length === 1 && (items[0]?.required_quantity ?? 1) === 1 ? items[0] : undefined
    if (!variant.manage_inventory || !item) {
      untracked += 1
      continue
    }
    // Two variants on one item: the item moves once
    if (seen.has(item.inventory_item_id)) {
      continue
    }
    seen.add(item.inventory_item_id)
    const level = item.inventory?.location_levels?.find((each) => each.location_id === locationId)
    const current = level ? Number(level.stocked_quantity) : 0
    const next = change.mode === "set" ? change.value : current + change.value
    if (next < 0) {
      return skipped("bulk_edit.stock_negative")
    }
    if (next > MAX_QUANTITY) {
      return skipped("bulk_edit.stock_out_of_range")
    }
    if (next === current) {
      continue
    }
    const key = { inventory_item_id: item.inventory_item_id, location_id: locationId }
    if (!level) {
      create.push({ ...key, stocked_quantity: next })
    } else if (change.mode === "set") {
      update.push({ ...key, stocked_quantity: next })
    } else {
      adjust.push({ ...key, adjustment: change.value })
    }
    diff[`level:${item.inventory_item_id}:stocked_quantity`] = {
      before: level ? current : null,
      after: next,
    }
  }
  if (create.length + update.length + adjust.length > 0) {
    return writing({ action: "stock", create, update, adjust }, diff)
  }
  return variants.length > 0 && untracked === variants.length
    ? skipped("bulk_edit.stock_untracked")
    : UNCHANGED
}
