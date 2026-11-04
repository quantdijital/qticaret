import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CATALOG_EXTENSION_MODULE } from "../../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../../modules/catalog-extension/service"

/** GET /admin/category-images (adr/0046 Ek 2026-11-04): every category's picture, by category. */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const rows = await req.scope
    .resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    .listCategoryImages({}, { select: ["category_id", "url", "alt"], take: null })
  res.json({
    images: rows.map(({ category_id, url, alt }) => ({ category_id, url, alt })),
  })
}
