import { model } from "@medusajs/framework/utils"

/**
 * A wholesale price entered by hand (ADR-0068 §4): the list it belongs to,
 * the variant and the amount as entered, **KDV excluded**, in kuruş. The
 * list's row holds the KDV-included price worked out from it with the
 * variant's KDV rate; a rate never overwrites it, and a new KDV rate
 * works the row out again from this amount.
 */
export const WholesaleManualPrice = model
  .define("wholesale_manual_price", {
    id: model.id({ prefix: "wmp" }).primaryKey(),
    price_list_id: model.text(),
    variant_id: model.text(),
    /** Kuruş, KDV excluded. */
    net_amount: model.number(),
    created_by: model.text().nullable(),
  })
  .indexes([
    { on: ["price_list_id", "variant_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["variant_id"], where: "deleted_at IS NULL" },
  ])
