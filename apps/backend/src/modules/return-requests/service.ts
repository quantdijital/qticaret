import { MedusaService } from "@medusajs/framework/utils"
import { ReturnRequest } from "./models/return-request"

/** Shoppers' return requests (F7.9, adr/0032). */
class ReturnRequestsModuleService extends MedusaService({ ReturnRequest }) {}

export default ReturnRequestsModuleService
