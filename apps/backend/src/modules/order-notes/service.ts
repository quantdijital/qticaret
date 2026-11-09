import { MedusaService } from "@medusajs/framework/utils"
import { CustomerNote } from "./models/customer-note"
import { OrderNote } from "./models/order-note"

/** The longest note: a call's summary, not a document. */
export const ORDER_NOTE_MAX = 2000

/** The team's notes: on orders (F12.8), and one on each customer (2026-11-06). */
class OrderNotesModuleService extends MedusaService({ OrderNote, CustomerNote }) {}

export default OrderNotesModuleService
