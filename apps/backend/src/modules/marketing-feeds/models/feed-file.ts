import { model } from "@medusajs/framework/utils"

/** A target's latest feed, in the shop's private storage (F10.8, adr/0038 §3). */
export const FeedFile = model
  .define("feed_file", {
    id: model.id({ prefix: "feedfile" }).primaryKey(),
    /** google, meta; Akakçe and Cimri once their formats are in hand. */
    target: model.text(),
    file_key: model.text(),
    item_count: model.number(),
    generated_at: model.dateTime(),
  })
  .indexes([{ on: ["target"], unique: true, where: "deleted_at IS NULL" }])
