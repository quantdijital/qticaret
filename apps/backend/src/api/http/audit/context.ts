import type { AuthenticatedMedusaRequest, MedusaRequest } from "@medusajs/framework/http"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import type { AuditEntryInput } from "../../../modules/audit-log/service"
import { clientIp } from "../client-ip"

const present = (value: string | undefined): string | null =>
  value === undefined || value === "" ? null : value

/** Who and where, for an audit entry: the actor Medusa's admin auth set, IP, user agent, request ID. */
export function auditContext(
  req: MedusaRequest
): Pick<AuditEntryInput, "actor_type" | "actor_id" | "request_id" | "ip" | "user_agent"> {
  const auth = (req as Partial<AuthenticatedMedusaRequest>).auth_context
  return {
    actor_type: present(auth?.actor_type),
    // Empty while an invite is being accepted: the user does not exist yet
    actor_id: present(auth?.actor_id),
    request_id: req.requestId ?? null,
    ip: clientIp(req),
    user_agent: req.headers["user-agent"] ?? null,
  }
}

export const auditService = (req: MedusaRequest): AuditLogModuleService =>
  req.scope.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
