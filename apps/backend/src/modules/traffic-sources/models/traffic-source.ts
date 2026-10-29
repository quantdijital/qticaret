import { model } from "@medusajs/framework/utils"
import { TRAFFIC_SOURCES } from "../../../lib/reports/traffic"

/**
 * A cart's first landing (F11.2, adr/0039 §2): its class and the words it
 * was classed by; nothing of the person (no IP, no browser, no address).
 * The order is found by its cart.
 */
export const TrafficSourceRecord = model
  .define("traffic_source", {
    id: model.id({ prefix: "tsrc" }).primaryKey(),
    cart_id: model.text(),
    source: model.enum([...TRAFFIC_SOURCES]),
    utm_source: model.text().nullable(),
    utm_medium: model.text().nullable(),
    utm_campaign: model.text().nullable(),
    referrer_host: model.text().nullable(),
  })
  .indexes([{ on: ["cart_id"], unique: true, where: "deleted_at IS NULL" }])
