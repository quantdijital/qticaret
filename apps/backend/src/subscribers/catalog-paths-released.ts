import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { CATALOG_ENTITY_TYPES } from "../workflows/catalog/entity-paths"
import { releaseCatalogPathsWorkflow } from "../workflows/catalog/release-catalog-paths"

const OWNERS: Readonly<Record<string, string>> = {
  "product.deleted": CATALOG_ENTITY_TYPES.product,
  "product-category.deleted": CATALOG_ENTITY_TYPES.category,
  "product-collection.deleted": CATALOG_ENTITY_TYPES.collection,
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
}

export const config: SubscriberConfig = {
  event: Object.keys(OWNERS),
}
