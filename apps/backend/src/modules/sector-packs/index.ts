import { Module } from "@medusajs/framework/utils"
import SectorPacksModuleService from "./service"

/** The sector packs this shop was set up with and the items each offered (adr/0061 C12). */
export const SECTOR_PACKS_MODULE = "sectorPacks"

export default Module(SECTOR_PACKS_MODULE, { service: SectorPacksModuleService })
