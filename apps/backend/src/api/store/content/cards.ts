import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { docStats } from "../../../lib/content"
import type { CardTarget, CardTargets, ContentDoc, ImageSize } from "../../../lib/content"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES, CATALOG_LOCALE } from "../../../workflows/catalog/entity-paths"
import { coversOf } from "./covers"

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

/** The library's sizes of a document's pictures, by address; one not measured is left out. */
async function imageSizesOf(
  container: MedusaContainer,
  srcs: readonly string[]
): Promise<Map<string, ImageSize>> {
  const sizes = new Map<string, ImageSize>()
  for (const [url, cover] of await coversOf(container, srcs)) {
    const { image_width: width, image_height: height } = cover
    if (width && height && width > 0 && height > 0) {
      sizes.set(url, { width, height })
    }
  }
  return sizes
}

/**
 * The live records a document's cards show, at their current paths (F3.16),
 * and its pictures' sizes from the media library (docs/21 2026-11-06, 8).
 */
export async function cardTargets(
  container: MedusaContainer,
  doc: ContentDoc
): Promise<CardTargets> {
  const { cards, images } = docStats(doc)
  const [products, categories, sizes] = await Promise.all([
    targetsOf(container, "product", [...new Set(cards.product)]),
    targetsOf(container, "category", [...new Set(cards.category)]),
    imageSizesOf(
      container,
      images.map((image) => image.src)
    ),
  ])
  return { product: products, category: categories, images: sizes }
}
