import { Module } from "@medusajs/framework/utils"
import BrandsModuleService from "./service"

/** Brands and their pages (F3.11). */
export const BRANDS_MODULE = "brands"

export default Module(BRANDS_MODULE, {
  service: BrandsModuleService,
})
