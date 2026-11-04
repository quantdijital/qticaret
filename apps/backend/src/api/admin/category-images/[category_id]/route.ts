import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setCategoryImageWorkflow } from "../../../../workflows/catalog/category-images"
import type { AdminPostCategoryImageType } from "../validators"

/**
 * POST /admin/category-images/:category_id (adr/0046 Ek 2026-11-04): the
 * category's picture from the media library, or `image: null` to take it
 * off. The storefront's category cards and mega menu show it.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCategoryImageType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await setCategoryImageWorkflow(req.scope).run({
    input: {
      category_id: req.params["category_id"] ?? "",
      image: req.validatedBody.image,
    },
  })
  res.json({ image: result.image ? { category_id: result.category_id, ...result.image } : null })
}
