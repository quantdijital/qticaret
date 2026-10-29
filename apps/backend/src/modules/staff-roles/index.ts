import { Module } from "@medusajs/framework/utils"
import StaffRolesModuleService from "./service"

/** Each staff member's role (F12.6, adr/0040). */
export const STAFF_ROLES_MODULE = "staff_roles"

export default Module(STAFF_ROLES_MODULE, { service: StaffRolesModuleService })
