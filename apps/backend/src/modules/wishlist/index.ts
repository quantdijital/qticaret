import { Module } from "@medusajs/framework/utils"
import WishlistModuleService from "./service"

/** Customers' saved products (F10.4, adr/0037 §4). */
export const WISHLIST_MODULE = "wishlist"

export default Module(WISHLIST_MODULE, { service: WishlistModuleService })
