import { model } from "@medusajs/framework/utils"

/**
 * What a Medusa secret API key may reach (F11.6, adr/0039 §6): Medusa's
 * keys have no scope, so a key without a row here reaches nothing.
 */
export const ApiKeyScope = model
  .define("api_key_scope", {
    id: model.id({ prefix: "apkscope" }).primaryKey(),
    api_key_id: model.text(),
    scopes: model.array(),
  })
  .indexes([{ on: ["api_key_id"], unique: true, where: "deleted_at IS NULL" }])
