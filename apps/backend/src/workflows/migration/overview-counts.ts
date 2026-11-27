import type { Knex } from "@medusajs/framework/mikro-orm/knex"
import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules, composeTableName } from "@medusajs/framework/utils"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"

type Container = Pick<MedusaContainer, "resolve">

/**
 * The product ↔ catalog extension link's table, as Medusa's link module
 * names it (links/product-catalog-extension.ts): its services and keys.
 */
export const PRODUCT_EXTENSION_LINK = composeTableName(
  Modules.PRODUCT,
  "product_id",
  CATALOG_EXTENSION_MODULE,
  "product_extension_id"
).toLowerCase()

/**
 * The overview's counts of moved products and categories here, each one
 * statement (adr/0042 Ek 2026-11-27): no document is read. Products and
 * categories deleted since are not counted: there is nothing to fill.
 * Only constants are written into the SQL.
 */
export const MOVED_RECORDS_SQL = `
WITH moved_products AS (
  SELECT DISTINCT item.target_id AS id
  FROM migration_item item
  JOIN product ON product.id = item.target_id AND product.deleted_at IS NULL
  WHERE item.kind = 'product' AND item.status = 'done' AND item.deleted_at IS NULL
),
moved_categories AS (
  SELECT DISTINCT item.target_id AS id
  FROM migration_item item
  JOIN product_category category ON category.id = item.target_id AND category.deleted_at IS NULL
  WHERE item.kind = 'category' AND item.status = 'done' AND item.deleted_at IS NULL
)
SELECT
  (SELECT count(*) FROM moved_products)::int AS products,
  (SELECT count(*) FROM moved_products moved
    WHERE NOT EXISTS (
      SELECT 1 FROM ${PRODUCT_EXTENSION_LINK} link
      JOIN product_extension extension
        ON extension.id = link.product_extension_id AND extension.deleted_at IS NULL
      WHERE link.product_id = moved.id AND link.deleted_at IS NULL
        AND extension.summary_doc IS NOT NULL AND extension.summary_doc <> 'null'::jsonb
    ))::int AS without_summary,
  (SELECT count(*) FROM moved_categories moved
    WHERE NOT EXISTS (
      SELECT 1 FROM category_image image
      WHERE image.category_id = moved.id AND image.deleted_at IS NULL
    ))::int AS without_cover
`

export interface MovedRecordCounts {
  /** Moved products still here. */
  products: number
  /** Of those, without a short description. */
  without_summary: number
  /** Moved categories still here without their own picture. */
  without_cover: number
}

export async function movedRecordCounts(container: Container): Promise<MovedRecordCounts> {
  const knex = container.resolve<Knex>(ContainerRegistrationKeys.PG_CONNECTION)
  const result = await knex.raw<{ rows: MovedRecordCounts[] }>(MOVED_RECORDS_SQL)
  return result.rows[0] ?? { products: 0, without_summary: 0, without_cover: 0 }
}
