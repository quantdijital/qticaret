import { Module } from "@medusajs/framework/utils"
import CartRemindersModuleService from "./service"

/** Abandoned cart reminders (F10.7, adr/0038 §1). */
export const CART_REMINDERS_MODULE = "cart_reminders"

export default Module(CART_REMINDERS_MODULE, { service: CartRemindersModuleService })
