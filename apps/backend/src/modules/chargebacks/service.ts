import { MedusaService } from "@medusajs/framework/utils"
import { Chargeback } from "./models/chargeback"

export { NEXT_STATUS, isClosed } from "./states"
export type { ChargebackReason, ChargebackStatus } from "./states"

/** Disputes of order payments (F6.7, adr/0030). */
class ChargebacksModuleService extends MedusaService({ Chargeback }) {}

export default ChargebacksModuleService
