import { model } from "@medusajs/framework/utils"
import { SHIPMENT_STATUSES } from "../states"
import { ShipmentEvent } from "./shipment-event"

/**
 * A parcel a carrier carries for an order (F7.5, adr/0031): the
 * fulfillment it ships, the carrier's own id for it, its tracking number
 * and where it stands. No address or name: the order holds those.
 */
export const TrackedShipment = model
  .define("tracked_shipment", {
    id: model.id({ prefix: "trk" }).primaryKey(),
    fulfillment_id: model.text(),
    order_id: model.text(),
    provider: model.text(),
    provider_shipment_id: model.text(),
    tracking_number: model.text().nullable(),
    tracking_url: model.text().nullable(),
    status: model.enum([...SHIPMENT_STATUSES]).default("created"),
    status_at: model.dateTime().nullable(),
    /** A test shipment at the carrier: nothing really travels. */
    test: model.boolean().default(false),
    /** When the carrier was last asked, by a notification or the job. */
    checked_at: model.dateTime().nullable(),
    events: model.hasMany(() => ShipmentEvent, { mappedBy: "shipment" }),
  })
  .indexes([
    { on: ["fulfillment_id"], unique: true },
    { on: ["provider", "provider_shipment_id"], unique: true },
    { on: ["status", "checked_at"] },
    { on: ["order_id"] },
  ])
