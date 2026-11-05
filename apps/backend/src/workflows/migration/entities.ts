import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"

/** What a migrated record's old address belongs to here, by the migration item's kind. */
export const ENTITY_OF: Readonly<Record<string, string>> = {
  product: CATALOG_ENTITY_TYPES.product,
  category: CATALOG_ENTITY_TYPES.category,
  brand: CATALOG_ENTITY_TYPES.brand,
  page: CATALOG_ENTITY_TYPES.page,
  post: CATALOG_ENTITY_TYPES.post,
  post_category: CATALOG_ENTITY_TYPES.post_category,
  post_tag: CATALOG_ENTITY_TYPES.post_tag,
}

/** The entity type a migration item's kind became, if any (own keys only). */
export const entityOf = (kind: string): string | undefined =>
  Object.hasOwn(ENTITY_OF, kind) ? ENTITY_OF[kind] : undefined
