import { model } from "@medusajs/framework/utils"

/** The last time the shop's products were sent to Merchant Center, for the panel (F10 M13). */
export const MerchantSync = model.define("merchant_sync", {
  id: model.id({ prefix: "msync" }).primaryKey(),
  sent: model.number(),
  removed: model.number(),
  failed: model.number(),
  /** Google's word when the run stopped (`PERMISSION_DENIED`, `invalid_grant`). */
  error: model.text().nullable(),
})
