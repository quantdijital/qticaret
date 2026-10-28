import { Module } from "@medusajs/framework/utils"
import ShipmentTrackingModuleService from "./service"

/** Carriers' parcels and their statuses (F7.5, adr/0031). */
export const SHIPMENT_TRACKING_MODULE = "shipmentTracking"

export default Module(SHIPMENT_TRACKING_MODULE, { service: ShipmentTrackingModuleService })
