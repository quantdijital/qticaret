import { Module } from "@medusajs/framework/utils"
import OrderNotesModuleService from "./service"

/** Staff notes on orders (F12.8). */
export const ORDER_NOTES_MODULE = "order_notes"

export default Module(ORDER_NOTES_MODULE, { service: OrderNotesModuleService })
