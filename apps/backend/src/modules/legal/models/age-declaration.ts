import { model } from "@medusajs/framework/utils"

/**
 * A buyer's declaration of age for a cart holding a restricted product
 * (F13.3, adr/0041 §4): only that they declared reaching the shop's limit,
 * the limit, and when. The date of birth is checked and never kept. The
 * order finds it by its cart.
 */
export const AgeDeclaration = model
  .define("age_declaration", {
    id: model.id({ prefix: "agedec" }).primaryKey(),
    cart_id: model.text(),
    min_age: model.number(),
    declared_at: model.dateTime(),
  })
  .indexes([
    {
      name: "IDX_age_declaration_cart",
      on: ["cart_id"],
      unique: true,
      where: "deleted_at IS NULL",
    },
  ])
