import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

export interface InventorySettings {
  /** An item at or under this many sellable units is low (adr/0020); items may set their own. */
  low_stock_threshold: number
}

/** Stock rules (F3.8): the shop's default low-stock threshold. */
export const inventorySection = defineSection<InventorySettings>(
  "inventory",
  { low_stock_threshold: z.number().int().min(0).max(100_000) },
  { low_stock_threshold: 5 }
)
