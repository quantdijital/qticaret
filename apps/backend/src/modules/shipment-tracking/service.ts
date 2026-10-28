import { MedusaService } from "@medusajs/framework/utils"
import { ShipmentEvent } from "./models/shipment-event"
import { TrackedShipment } from "./models/tracked-shipment"

/** Parcels carriers carry for orders, and the statuses each reached (F7.5, adr/0031). */
class ShipmentTrackingModuleService extends MedusaService({ TrackedShipment, ShipmentEvent }) {}

export default ShipmentTrackingModuleService
