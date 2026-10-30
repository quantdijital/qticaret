import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATALOG_EXTENSION_MODULE } from "../../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../../modules/catalog-extension/service"

/** GET /admin/category-restrictions (F13.4): the categories marked adults only, and why. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const rows = await req.scope
    .resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    .listCategoryRestrictions({}, { select: ["category_id", "restriction"] })
  res.json({
    restrictions: rows.map(({ category_id, restriction }) => ({ category_id, restriction })),
  })
}
