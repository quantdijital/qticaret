import { Module } from "@medusajs/framework/utils"
import ReturnRequestsModuleService from "./service"

/** Shoppers' return requests, from the request to the refund (F7.9, adr/0032). */
export const RETURN_REQUESTS_MODULE = "returnRequests"

export default Module(RETURN_REQUESTS_MODULE, { service: ReturnRequestsModuleService })
