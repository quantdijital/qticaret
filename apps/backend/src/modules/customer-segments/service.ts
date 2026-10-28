import { MedusaService } from "@medusajs/framework/utils"
import { CustomerSegment } from "./models/customer-segment"

/** Rule-based customer segments (F10.3, adr/0037 §6): the definitions; members live in Medusa groups. */
class CustomerSegmentsModuleService extends MedusaService({ CustomerSegment }) {}

export default CustomerSegmentsModuleService
