/**
 * A product's catalogue data saved outside Medusa's own product workflows
 * (its brand, attribute values, catalogue fields): `{ id }`, emitted once
 * the save's workflow is done. Medusa's `product.updated` does not come
 * for these; the search index (adr/0056) listens to both.
 */
export const CATALOG_PRODUCT_SAVED = "catalog.product_saved"
