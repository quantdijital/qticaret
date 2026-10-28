import type { Context } from "@medusajs/framework/types"
import { InjectTransactionManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { ValidationError, uniqueViolationKeys } from "../../lib/errors"
import { WishlistItem } from "./models/wishlist-item"

/** How many products one customer keeps: a list, not a catalog copy. */
export const WISHLIST_LIMIT = 200

/** Customers' saved products (F10.4, adr/0037 §4). */
class WishlistModuleService extends MedusaService({ WishlistItem }) {
  /** Keeps the product (and variant) for the customer; kept already is no change. */
  async keep(input: {
    customer_id: string
    product_id: string
    variant_id?: string | null
  }): Promise<{ id: string; created: boolean }> {
    try {
      return await this.keep_(input)
    } catch (error) {
      // Two taps at once: the other one kept it
      if (!uniqueViolationKeys(error)?.includes("customer_id")) {
        throw error
      }
      return this.keep_(input)
    }
  }

  @InjectTransactionManager()
  protected async keep_(
    input: { customer_id: string; product_id: string; variant_id?: string | null },
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; created: boolean }> {
    const key = {
      customer_id: input.customer_id,
      product_id: input.product_id,
      variant_id: input.variant_id ?? "",
    }
    const [existing] = await this.listWishlistItems(key, { take: 1, select: ["id"] }, sharedContext)
    if (existing) {
      return { id: existing.id, created: false }
    }
    const count = await this.listAndCountWishlistItems(
      { customer_id: input.customer_id },
      { take: 1, select: ["id"] },
      sharedContext
    )
    if (count[1] >= WISHLIST_LIMIT) {
      throw new ValidationError("wishlist.full")
    }
    const created = await this.createWishlistItems(key, sharedContext)
    return { id: created.id, created: true }
  }
}

export default WishlistModuleService
