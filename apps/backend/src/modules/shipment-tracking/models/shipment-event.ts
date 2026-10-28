import { model } from "@medusajs/framework/utils"
import { SHIPMENT_STATUSES } from "../states"
import { TrackedShipment } from "./tracked-shipment"

/**
 * A status a parcel reached, once each (adr/0031): a notification and the
 * job finding the same move record it once. The carrier's own code is
 * kept for support; never a person's details.
 */
export const ShipmentEvent = model
  .define("shipment_event", {
    id: model.id({ prefix: "shev" }).primaryKey(),
    shipment: model.belongsTo(() => TrackedShipment, { mappedBy: "events" }),
    status: model.enum([...SHIPMENT_STATUSES]),
    occurred_at: model.dateTime(),
    provider_status: model.text().nullable(),
  })
  .indexes([{ on: ["shipment_id", "status"], unique: true }])
