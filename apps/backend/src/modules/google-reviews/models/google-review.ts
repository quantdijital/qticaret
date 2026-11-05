import { model } from "@medusajs/framework/utils"

/**
 * A Google review of the shop's location (adr/0058), as Google gives it:
 * kept only to show it, changed and removed as Google changes and removes
 * it at each sync. `hidden` is the shop's alone: off the storefront, kept
 * across syncs; Google's average and count stay Google's.
 */
export const GoogleReview = model
  .define("google_review", {
    id: model.id({ prefix: "grev" }).primaryKey(),
    /** Google's `reviewId`. */
    review_id: model.text(),
    /** As Google shows the reviewer; an anonymous one's has no photo. */
    reviewer_name: model.text().nullable(),
    reviewer_photo_url: model.text().nullable(),
    rating: model.number(),
    comment: model.text().nullable(),
    written_at: model.dateTime(),
    edited_at: model.dateTime(),
    /** The owner's reply as Google shows it. */
    reply: model.text().nullable(),
    replied_at: model.dateTime().nullable(),
    hidden: model.boolean().default(false),
  })
  .indexes([
    { on: ["review_id"], unique: true, where: "deleted_at IS NULL" },
    { on: ["written_at"], where: "deleted_at IS NULL" },
  ])
