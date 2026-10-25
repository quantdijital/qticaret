import { Module } from "@medusajs/framework/utils"
import AuditLogModuleService from "./service"

/** Append-only audit log of admin mutations, personal data reads and system actions (F2.5, adr/0011). */
export const AUDIT_LOG_MODULE = "auditLog"

export default Module(AUDIT_LOG_MODULE, {
  service: AuditLogModuleService,
})
