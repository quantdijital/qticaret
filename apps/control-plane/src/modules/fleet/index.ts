import { Module } from "@medusajs/framework/utils"
import FleetModuleService from "./service"

/** The shops as a fleet (adr/0061 §2): their public keys (C8), plan documents (C9); usage, health later. */
export const FLEET_MODULE = "fleet"

export default Module(FLEET_MODULE, { service: FleetModuleService })
