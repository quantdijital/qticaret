import { model } from "@medusajs/framework/utils"
import { RESTRICTIONS } from "../../../lib/catalog/restrictions"

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
 * - `withdrawal_excluded`: the product's own withdrawal mark (F13.6, adr/0041
 *   §3), read by its kind (adr/0052 Ek 2026-11-03, `productMarkOf`): a
 *   physical product is a sealed hygiene good, returnable while unopened
 *   (MSY md. 15/1-ç); a digital or service one is out once delivered or
 *   performed (md. 15/1-ğ, h). A faulty or wrong item still comes back;
 * - `restriction`: sold to adults only, and why (F13.4, adr/0041 §4); a
 *   category's mark reaches the product too;
 * - `is_gift_card`: its variants are gift card amounts; a paid unit issues
 *   a card to the recipient the line names (adr/0025 Ek 2026-11-03). Not
 *   Medusa's `is_giftcard`: the loyalty plugin issues weak codes for that
 *   one as the order is placed, before it is paid.
 * - `addons`: up to five add-ons a shopper picks on the product page (a
 *   typed text, one of a few choices), each with its price in lira
 *   (adr/0052). The shape is `lib/catalog/addons`' schema; null: none.
 * - `description_doc`: the long description as a content document
 *   (adr/0055, `lib/catalog/description`); `product.description` keeps its
 *   plain text. Null: the product has plain text only.
 */
export const ProductExtension = model.define("product_extension", {
  id: model.id({ prefix: "pext" }).primaryKey(),
  condition: model.enum([...PRODUCT_CONDITIONS]).default("new"),
  kind: model.enum([...PRODUCT_KINDS]).default("physical"),
  primary_category_id: model.text().nullable(),
  successor_product_id: model.text().nullable(),
  withdrawal_excluded: model.boolean().default(false),
  restriction: model.enum([...RESTRICTIONS]).nullable(),
  is_gift_card: model.boolean().default(false),
  addons: model.json().nullable(),
  description_doc: model.json().nullable(),
})
