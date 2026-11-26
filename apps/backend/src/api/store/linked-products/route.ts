import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { linkedProductIds } from "../../../workflows/catalog/linked-products-read"
import type { StoreGetLinkedProductsType } from "./validators"

/**
 * GET /store/linked-products (S3): the products a product page offers in
 * place of its "similar products" (`upsell`), or a cart offers beside its
 * lines (`cross_sell`), as ids in the shop's order; only published ones in
 * the shopper's sales channels, none of the given products, sold-out ones
 * left out while the shop hides them from its listings. The storefront
 * reads the cards by these ids.
 */
export async function GET(
  req: MedusaStoreRequest<unknown, StoreGetLinkedProductsType>,
  res: MedusaResponse
): Promise<void> {
  const { kind, product_id } = req.validatedQuery
  const ids = await linkedProductIds(req.scope, {
    kind,
    product_ids: [...new Set(product_id)],
    sales_channel_ids: req.publishable_key_context.sales_channel_ids,
  })
  res.json({ product_ids: ids })
}
