import { model } from "@medusajs/framework/utils"

/** How far a feed of events was read (the stock ledger's `seq`), so each is queued once. */
export const WebhookCursor = model
  .define("webhook_cursor", {
    id: model.id({ prefix: "whcur" }).primaryKey(),
    name: model.text(),
    position: model.number().default(0),
  })
  .indexes([{ on: ["name"], unique: true, where: "deleted_at IS NULL" }])
