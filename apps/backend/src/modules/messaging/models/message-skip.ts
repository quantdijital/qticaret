import { model } from "@medusajs/framework/utils"

/** Why a message was not sent (adr/0036): what `deliver` decided before any provider. */
export const MESSAGE_SKIP_REASONS = [
  "channel_off",
  "invalid_recipient",
  "suppressed",
  "no_consent",
  "over_quota",
] as const
export type MessageSkipReason = (typeof MESSAGE_SKIP_REASONS)[number]

/**
 * A message the platform did not send, and why (F12.8): the panel's
 * communication history shows it beside the ones Medusa sent. One per
 * send (template, channel, resource, key), the latest reason; gone once
 * that send goes out. The address only masked.
 */
export const MessageSkip = model
  .define("message_skip", {
    id: model.id({ prefix: "mskip" }).primaryKey(),
    /** The send's idempotency key, as Medusa's notification would carry it. */
    send_key: model.text(),
    template: model.text(),
    channel: model.enum(["email", "sms"]),
    reason: model.enum([...MESSAGE_SKIP_REASONS]),
    resource_type: model.text(),
    resource_id: model.text(),
    receiver_id: model.text().nullable(),
    recipient_masked: model.text().nullable(),
  })
  .indexes([
    { on: ["send_key"], unique: true, where: "deleted_at IS NULL" },
    { on: ["resource_id"], where: "deleted_at IS NULL" },
    { on: ["receiver_id"], where: "deleted_at IS NULL" },
    { on: ["updated_at"], where: "deleted_at IS NULL" },
  ])
