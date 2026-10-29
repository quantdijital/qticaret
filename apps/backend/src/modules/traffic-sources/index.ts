import { Module } from "@medusajs/framework/utils"
import TrafficSourcesModuleService from "./service"

/** Where carts came from, for the sales report's traffic sources (F11.2, adr/0039 §2). */
export const TRAFFIC_SOURCES_MODULE = "traffic_sources"

export default Module(TRAFFIC_SOURCES_MODULE, { service: TrafficSourcesModuleService })
