import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { URL_REGISTRY_MODULE } from "../../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../../modules/url-registry/service"
import { CATALOG_LOCALE } from "../../../../workflows/catalog/entity-paths"
import type { StoreGetSeoPathsType } from "../validators"

/**
 * `GET /store/seo/paths?type=&id=` (adr/0046 §3): where each record lives
 * on the storefront, from the URL registry, so a theme links to a product
 * or a category without knowing the shop's URL style. Only active paths;
 * a record without one is left out of the answer. The storefront asks only
 * for records the Store API already showed it.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetSeoPathsType>,
  res: MedusaResponse
): Promise<void> {
  const { type, id } = req.validatedQuery as StoreGetSeoPathsType
  const entries = await req.scope
    .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    .listUrlEntries(
      { locale: CATALOG_LOCALE, entity_type: type, entity_id: id, status: "active" },
      { select: ["entity_id", "path"], take: id.length }
    )
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({ paths: Object.fromEntries(entries.map((entry) => [entry.entity_id, entry.path])) })
}
