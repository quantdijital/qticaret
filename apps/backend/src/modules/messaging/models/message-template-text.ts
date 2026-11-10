import { model } from "@medusajs/framework/utils"

/**
 * A customer message as the shop worded it (adr/0036 Ek 2026-11-10): its
 * own subject, preview line, title, opening text and SMS, each null for
 * the platform's default, and whether it goes at all. One row per
 * template; a required template is sent whatever `enabled` says. Plain
 * text with `{belirteç}`s, checked on save; never HTML.
 */
export const MessageTemplateText = model
  .define("message_template_text", {
    id: model.id({ prefix: "mtxt" }).primaryKey(),
    /** The template's name (`order.shipped`). */
    template: model.text(),
    enabled: model.boolean().default(true),
    subject: model.text().nullable(),
    preheader: model.text().nullable(),
    heading: model.text().nullable(),
    intro: model.text().nullable(),
    sms: model.text().nullable(),
    /** The staff member who saved it last. */
    updated_by: model.text().nullable(),
  })
  .indexes([{ on: ["template"], unique: true, where: "deleted_at IS NULL" }])
