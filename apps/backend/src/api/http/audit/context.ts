import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import type { AuditEntryInput } from "../../../modules/audit-log/service"
import type { GraphQuery } from "./registry"

/** Who and where, for an audit entry: the actor Medusa's admin auth set, IP, user agent, request ID. */
export function auditContext(
  req: MedusaRequest
): Pick<AuditEntryInput, "actor_type" | "actor_id" | "request_id" | "ip" | "user_agent"> {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  return {
    actor_type: auth?.actor_type ?? null,
    actor_id: auth?.actor_id ?? null,
    request_id: req.requestId ?? null,
    ip: req.ip ?? null,
    user_agent: req.headers["user-agent"] ?? null,
  }
}

export const auditService = (req: MedusaRequest): AuditLogModuleService =>
  req.scope.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)

export const graphQuery = (req: MedusaRequest): GraphQuery =>
  req.scope.resolve<GraphQuery>(ContainerRegistrationKeys.QUERY)
