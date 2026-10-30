import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { setCategoryRestrictionWorkflow } from "../../../../workflows/catalog/restrictions"
import type { AdminPostCategoryRestrictionType } from "../validators"

/**
 * POST /admin/category-restrictions/:category_id (F13.4, adr/0041 §4): marks
 * the category adults only, its children and their products too, or clears
 * the mark. Marking needs the `catalog.restricted` flag.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostCategoryRestrictionType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await setCategoryRestrictionWorkflow(req.scope).run({
    input: {
      category_id: req.params["category_id"] ?? "",
      restriction: req.validatedBody.restriction,
    },
  })
  res.json({ restriction: result })
}
