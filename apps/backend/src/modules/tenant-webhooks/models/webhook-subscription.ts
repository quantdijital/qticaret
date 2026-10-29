import { model } from "@medusajs/framework/utils"

/**
 * Where the shop's own systems hear of its events (F11.7, adr/0039 §7):
 * an https address, the events it takes, and the secret its bodies are
 * signed with (encrypted; shown once). Eight failed tries in a row turn it
 * off and staff are told.
 */
export const WebhookSubscription = model.define("webhook_subscription", {
  id: model.id({ prefix: "whsub" }).primaryKey(),
  url: model.text(),
  events: model.array(),
  secret_encrypted: model.text(),
  status: model.enum(["active", "disabled"]).default("active"),
  failure_streak: model.number().default(0),
  disabled_at: model.dateTime().nullable(),
  created_by: model.text().nullable(),
})
