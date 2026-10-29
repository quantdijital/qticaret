import { model } from "@medusajs/framework/utils"

/**
 * A Google connection under way (F10 M13): the `state` Google sends back,
 * kept as a hash, with the PKCE verifier, encrypted, that only the server
 * holds; used once, for ten minutes, by the staff member who started it.
 */
export const GoogleOauthState = model
  .define("google_oauth_state", {
    id: model.id({ prefix: "gstate" }).primaryKey(),
    state_hash: model.text(),
    verifier_encrypted: model.text(),
    user_id: model.text(),
    expires_at: model.dateTime(),
  })
  .indexes([{ on: ["state_hash"], unique: true, where: "deleted_at IS NULL" }])
