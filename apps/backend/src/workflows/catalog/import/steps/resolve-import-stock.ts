import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { StockLine } from "../plan-variants"
import { keyedVariants } from "./keyed-variants"

export interface ImportStockInput {
  product_id: string
  location_id: string | null
  stock: StockLine[]
}

export interface ImportStockLevels {
  create: { inventory_item_id: string; location_id: string; stocked_quantity: number }[]
  update: { inventory_item_id: string; location_id: string; stocked_quantity: number }[]
}

interface VariantRow {
  id: string
  options?: { value: string; option_id: string }[] | null
  inventory_items?:
    | {
        inventory_item_id: string
        inventory?: { location_levels?: { location_id: string }[] | null } | null
      }[]
    | null
}

/**
 * The stock levels a sheet's quantities make at the default location
 * (F3.9): a variant this import made is found by its option values; a
 * level there is updated, a missing one made. Reads only; the level
 * workflows write and undo.
 */
export const resolveImportStockStep = createStep(
  "catalog-import-resolve-stock",
  async (input: ImportStockInput, { container }) => {
    const levels: ImportStockLevels = { create: [], update: [] }
    const location = input.location_id
    if (!location || input.stock.length === 0) {
      return new StepResponse(levels)
    }
    const variants = await keyedVariants<VariantRow>(container, input.product_id, [
      "variants.inventory_items.inventory_item_id",
      "variants.inventory_items.inventory.location_levels.location_id",
    ])
    for (const line of input.stock) {
      const variant = variants.find((each) =>
        line.variantId ? each.id === line.variantId : each.key === line.key
      )
      const item = variant?.inventory_items?.[0]
      if (!item) {
        continue
      }
      const level = {
        inventory_item_id: item.inventory_item_id,
        location_id: location,
        stocked_quantity: line.quantity,
      }
      const exists = (item.inventory?.location_levels ?? []).some(
        (each) => each.location_id === location
      )
      levels[exists ? "update" : "create"].push(level)
    }
    return new StepResponse(levels)
  }
)
