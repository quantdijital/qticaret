import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { docStats } from "../../../lib/content"
import type { CardTarget, CardTargets, ContentDoc } from "../../../lib/content"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../../../workflows/catalog/entity-paths"

const LIVE = {
  product: { entity: "product", name: "title", filters: { status: "published" } },
  category: {
    entity: "product_category",
    name: "name",
    filters: { is_active: true, is_internal: false },
  },
} as const

async function targetsOf(
  container: MedusaContainer,
  kind: keyof typeof LIVE,
  ids: string[]
): Promise<Map<string, CardTarget>> {
  const targets = new Map<string, CardTarget>()
  if (ids.length === 0) {
    return targets
  }
  const spec = LIVE[kind]
  const [{ data }, entries] = await Promise.all([
    container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: spec.entity,
      fields: ["id", spec.name],
      filters: { id: ids, ...spec.filters },
    }),
    container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE).listUrlEntries(
      {
        locale: CATALOG_LOCALE,
        entity_type: CATALOG_ENTITY_TYPES[kind],
        entity_id: ids,
        status: "active",
      },
      { select: ["entity_id", "path"] }
    ),
  ])
  const paths = new Map(entries.map((entry) => [entry.entity_id, entry.path]))
  for (const row of data as unknown as Record<string, string | undefined>[]) {
    const id = row["id"] ?? ""
    const path = paths.get(id)
    const title = row[spec.name]
    if (path && title) {
      targets.set(id, { title, path })
    }
  }
  return targets
}

/** The live records a document's cards show, at their current paths (F3.16). */
export async function cardTargets(
  container: MedusaContainer,
  doc: ContentDoc
): Promise<CardTargets> {
  const { product, category } = docStats(doc).cards
  const [products, categories] = await Promise.all([
    targetsOf(container, "product", [...new Set(product)]),
    targetsOf(container, "category", [...new Set(category)]),
  ])
  return { product: products, category: categories }
}
