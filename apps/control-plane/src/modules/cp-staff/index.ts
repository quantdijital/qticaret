import { Module } from "@medusajs/framework/utils"
import CpStaffModuleService from "./service"

/** Platform staff roles (adr/0061 §3.5). */
export const CP_STAFF_MODULE = "cp_staff"

export default Module(CP_STAFF_MODULE, { service: CpStaffModuleService })
