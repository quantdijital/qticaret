import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { URL_REGISTRY_MODULE } from "../../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../../modules/url-registry/service"
import {
  COLLECTION_LIVE_FIELDS,
  isCollectionShown,
} from "../../../../workflows/catalog/collection-fields"
import type { CollectionExtensionRow } from "../../../../workflows/catalog/collection-fields"
import { collectionsOn } from "../../../../workflows/catalog/collections-flag"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../../../../workflows/catalog/entity-paths"
import type { MedusaContainer } from "@medusajs/framework/types"
import type { StoreGetSeoPathsType } from "../validators"
import { varyOnPublishableKey } from "../../../../lib/http/vary"

/**
 * The asked collections whose page is public: none while the shop has
 * collections off, else the ones it did not hide (Ürünler > Koleksiyonlar).
 */
async function shownCollections(container: MedusaContainer, ids: string[]): Promise<string[]> {
  if (!(await collectionsOn(container))) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_collection",
    fields: ["id", ...COLLECTION_LIVE_FIELDS],
    filters: { id: ids },
  })
  return (data as { id: string; collection_extension?: CollectionExtensionRow | null }[])
    .filter((row) => isCollectionShown(row))
    .map((row) => row.id)
}

/**
 * `GET /store/seo/paths?type=&id=` (adr/0046 §3): where each record lives
 * on the storefront, from the URL registry, so a theme links to a product
 * or a category without knowing the shop's URL style. Only active paths;
 * a record without one is left out of the answer, as is a collection whose
 * page is not public (hidden, or collections off). The storefront asks
 * only for records the Store API already showed it.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetSeoPathsType>,
  res: MedusaResponse
): Promise<void> {
  const { type, id } = req.validatedQuery as StoreGetSeoPathsType
  const ids = type === CATALOG_ENTITY_TYPES.collection ? await shownCollections(req.scope, id) : id
  const entries =
    ids.length === 0
      ? []
      : await req.scope
          .resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
          .listUrlEntries(
            { locale: CATALOG_LOCALE, entity_type: type, entity_id: ids, status: "active" },
            { select: ["entity_id", "path"], take: ids.length }
          )
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  varyOnPublishableKey(res)
  res.json({ paths: Object.fromEntries(entries.map((entry) => [entry.entity_id, entry.path])) })
}
