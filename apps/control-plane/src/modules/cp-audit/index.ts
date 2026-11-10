import { Module } from "@medusajs/framework/utils"
import CpAuditModuleService from "./service"

/** The control plane's append-only audit log (adr/0061 §3.5). */
export const CP_AUDIT_MODULE = "cp_audit"

export default Module(CP_AUDIT_MODULE, { service: CpAuditModuleService })
