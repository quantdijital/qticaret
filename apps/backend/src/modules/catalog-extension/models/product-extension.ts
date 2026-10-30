import { model } from "@medusajs/framework/utils"

export const PRODUCT_CONDITIONS = ["new", "refurbished", "used", "damaged"] as const
export const PRODUCT_KINDS = ["physical", "digital", "service"] as const

/**
 * What Medusa's product has no column for (F3.1, docs/13 §2.2 and §2.4),
 * linked one to one to the product:
 * - `condition`: schema.org `itemCondition` in JSON-LD and feeds;
 * - `kind`: physical products need weight and dimensions to be published;
 *   digital and service products sell without shipping (F3.2);
 * - `primary_category_id`: breadcrumb, JSON-LD and "back to category". The
 *   link to the category can go without an event, so readers check that it
 *   is still one of the product's categories;
 * - `successor_product_id`: where the product's URL points once it is no
 *   longer sold (a 301, docs/13 §2.4);
 * - `withdrawal_excluded`: outside the right of withdrawal (hygiene, made to
 *   order; F13.6, adr/0041 §3). A faulty or wrong item still comes back.
 */
export const ProductExtension = model.define("product_extension", {
  id: model.id({ prefix: "pext" }).primaryKey(),
  condition: model.enum([...PRODUCT_CONDITIONS]).default("new"),
  kind: model.enum([...PRODUCT_KINDS]).default("physical"),
  primary_category_id: model.text().nullable(),
  successor_product_id: model.text().nullable(),
  withdrawal_excluded: model.boolean().default(false),
})
