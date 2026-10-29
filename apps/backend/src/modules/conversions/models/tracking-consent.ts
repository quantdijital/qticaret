import { model } from "@medusajs/framework/utils"

/**
 * What the shopper allowed the shop's measurement to know (F10.9, adr/0038
 * §4), as the storefront's cookie banner recorded it: kept against the
 * cart, then the order. The shopper's own statement, from the storefront.
 * The IP address and browser Meta asks for are kept encrypted, and only
 * until the events went.
 */
export const TrackingConsent = model
  .define("tracking_consent", {
    id: model.id({ prefix: "trcons" }).primaryKey(),
    cart_id: model.text().nullable(),
    order_id: model.text().nullable(),
    /** GA4's events. */
    analytics: model.boolean(),
    /** Meta's events, and GA4's ad use. */
    marketing: model.boolean(),
    given_at: model.dateTime(),
    /** The browser as GA4 knows it (its `_ga` cookie). */
    ga_client_id: model.text().nullable(),
    /** Meta's own cookies (`_fbp`, `_fbc`). */
    fbp: model.text().nullable(),
    fbc: model.text().nullable(),
    page_url: model.text().nullable(),
    /** The IP address and browser, encrypted; cleared once no event needs them. */
    client_encrypted: model.text().nullable(),
  })
  .indexes([
    { on: ["cart_id"], unique: true, where: "deleted_at IS NULL AND cart_id IS NOT NULL" },
    { on: ["order_id"], unique: true, where: "deleted_at IS NULL AND order_id IS NOT NULL" },
  ])
