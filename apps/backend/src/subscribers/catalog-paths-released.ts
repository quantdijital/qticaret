import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import type { MedusaContainer } from "@medusajs/framework/types"
import { CONTENT_MODULE } from "../modules/content"
import type ContentModuleService from "../modules/content/service"
import { CATALOG_ENTITY_TYPES } from "../workflows/catalog/entity-paths"
import { releaseCatalogPathsWorkflow } from "../workflows/catalog/release-catalog-paths"

const OWNERS: Readonly<Record<string, string>> = {
  "product.deleted": CATALOG_ENTITY_TYPES.product,
  "product-category.deleted": CATALOG_ENTITY_TYPES.category,
  "product-collection.deleted": CATALOG_ENTITY_TYPES.collection,
}

// A deleted category's landing pages have no address left (F3.16): their
// paths answer 410 too. The pages stay in the panel, their text to copy.
async function releaseLandingsOf(container: MedusaContainer, categoryId: string) {
  const landings = await container
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listLandingPages({ category_id: categoryId }, { select: ["id"] })
  for (const landing of landings) {
    await releaseCatalogPathsWorkflow(container).run({
      input: { entity_type: CATALOG_ENTITY_TYPES.landing, entity_id: landing.id },
    })
  }
}

/** A deleted product, category or collection keeps its paths reserved (F3.1). */
export default async function catalogPathsReleased({
  event,
  container,
}: SubscriberArgs<{ id: string }>) {
  const entityType = Object.hasOwn(OWNERS, event.name) ? OWNERS[event.name] : undefined
  if (entityType === undefined) {
    return
  }
  await releaseCatalogPathsWorkflow(container).run({
    input: { entity_type: entityType, entity_id: event.data.id },
  })
  if (entityType === CATALOG_ENTITY_TYPES.category) {
    await releaseLandingsOf(container, event.data.id)
  }
}

export const config: SubscriberConfig = {
  event: Object.keys(OWNERS),
}
