import { model } from "@medusajs/framework/utils"

/**
 * The Business Profile location whose Google reviews the shop shows
 * (adr/0058): one at most. Its average and count are Google's own, as the
 * last sync read them, never worked out here; `synced_at` dates what is
 * kept (Google's policy: stored content is at most 30 days old).
 */
export const GoogleReviewLocation = model.define("google_review_location", {
  id: model.id({ prefix: "grloc" }).primaryKey(),
  /** `accounts/{id}`: the reviews are read through it. */
  account: model.text(),
  /** `locations/{id}`. */
  location: model.text(),
  title: model.text(),
  address: model.text().nullable(),
  maps_uri: model.text().nullable(),
  new_review_uri: model.text().nullable(),
  average_rating: model.float().nullable(),
  total_review_count: model.number().nullable(),
  /** When the reviews were last read whole; null before the first sync. */
  synced_at: model.dateTime().nullable(),
  /** Google's word when the last sync stopped (`PERMISSION_DENIED`, `invalid_grant`). */
  sync_error: model.text().nullable(),
})
