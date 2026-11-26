import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { categoryProductCounts } from "../../../lib/catalog/category-counts"

/**
 * GET /admin/category-counts (docs/06 "Kategoriler"): how many products
 * each category's filter shows in the product list, it and the ones below
 * it, drafts included: `{ counts: { [category_id]: number } }`. Counts
 * only; one read of the categories with their products' ids.
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const { data } = await req.scope.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "parent_category_id", "products.id"],
  })
  res.json({ counts: categoryProductCounts(data) })
}
