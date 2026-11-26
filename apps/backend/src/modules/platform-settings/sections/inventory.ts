import { z } from "@medusajs/framework/zod"
import { defineSection } from "./define"

/** What the shop's listings do with a product none of whose variants can be sold now (T1). */
export const OUT_OF_STOCK_LISTING = ["show", "hide"] as const
export type OutOfStockListing = (typeof OUT_OF_STOCK_LISTING)[number]

export interface InventorySettings {
  /** An item at or under this many sellable units is low (adr/0020); items may set their own. */
  low_stock_threshold: number
  /**
   * T1 (WooCommerce's "Hide out of stock items from the catalog"): `show`
   * lists them as before; `hide` leaves them out of category, collection,
   * brand, landing and campaign listings, the whole catalogue, site search
   * and its suggestions, and the categories' product counts. Their page
   * stays reachable by its address, in the sitemap, with `OutOfStock` in
   * its structured data. A variant whose stock is not tracked or that
   * sells past stock always counts as in stock.
   */
  out_of_stock_listing: OutOfStockListing
}

/** Stock rules (F3.8): the shop's default low-stock threshold, and whether listings hide what is sold out. */
export const inventorySection = defineSection<InventorySettings>(
  "inventory",
  {
    low_stock_threshold: z.number().int().min(0).max(100_000),
    out_of_stock_listing: z.enum(OUT_OF_STOCK_LISTING),
  },
  { low_stock_threshold: 5, out_of_stock_listing: "show" }
)
