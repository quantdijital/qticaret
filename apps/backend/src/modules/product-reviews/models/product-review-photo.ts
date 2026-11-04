import { model } from "@medusajs/framework/utils"

/**
 * A photo a customer added to their review (adr/0037 §4 Ek 2026-11-04):
 * checked by its bytes and stored cleaned (no EXIF/GPS), as every upload
 * is (docs/04). Uploaded first, then named by the review; one never put
 * on a review is removed after a day. Shown only while its review is
 * approved; goes with the review, with the customer's erasure (KVKK) and
 * when the author writes the review again with other photos.
 */
export const ProductReviewPhoto = model
  .define("product_review_photo", {
    id: model.id({ prefix: "rvph" }).primaryKey(),
    /** None until the review names it. */
    review_id: model.text().nullable(),
    product_id: model.text(),
    customer_id: model.text(),
    /** The stored file: its key in storage and its public address. */
    file_id: model.text(),
    url: model.text(),
    width: model.number(),
    height: model.number(),
    /** Its place on the review, first 0. */
    rank: model.number().default(0),
  })
  .indexes([
    { on: ["review_id"], where: "deleted_at IS NULL AND review_id IS NOT NULL" },
    { on: ["customer_id", "product_id"], where: "deleted_at IS NULL" },
    // The nightly sweep: uploads never put on a review
    { on: ["created_at"], where: "deleted_at IS NULL AND review_id IS NULL" },
  ])
