import { Module } from "@medusajs/framework/utils"
import CustomerSegmentsModuleService from "./service"

/** Customer segments by rules (F10.3, adr/0037 §6). */
export const CUSTOMER_SEGMENTS_MODULE = "customer_segments"

export default Module(CUSTOMER_SEGMENTS_MODULE, {
  service: CustomerSegmentsModuleService,
})
