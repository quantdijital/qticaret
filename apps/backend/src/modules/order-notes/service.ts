import { MedusaService } from "@medusajs/framework/utils"
import { OrderNote } from "./models/order-note"

/** The longest note: a call's summary, not a document. */
export const ORDER_NOTE_MAX = 2000

/** Staff notes on orders (F12.8). */
class OrderNotesModuleService extends MedusaService({ OrderNote }) {}

export default OrderNotesModuleService
