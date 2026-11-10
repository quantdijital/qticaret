import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CP_AUDIT_MODULE } from "../../../../modules/cp-audit"
import type CpAuditModuleService from "../../../../modules/cp-audit/service"
import type { GetCpAuditLogType } from "../validators"

const FIELDS = [
  "id",
  "kind",
  "actor_type",
  "actor_id",
  "action",
  "resource_type",
  "resource_id",
  "outcome",
  "changes",
  "request_id",
  "ip_hash",
  "created_at",
] as const

/**
 * GET /admin/cp/audit-log (owner, adr/0061 §3.5): the audit log, newest
 * first, a page at a time, by actor or kind of thing. Reading it is
 * recorded too.
 */
export async function GET(
  req: AuthenticatedMedusaRequest<unknown, GetCpAuditLogType>,
  res: MedusaResponse
): Promise<void> {
  const { limit, offset, actor_id, resource_type } = req.validatedQuery as GetCpAuditLogType
  const [entries, count] = await req.scope
    .resolve<CpAuditModuleService>(CP_AUDIT_MODULE)
    .listAndCountCpAuditEntries(
      { ...(actor_id ? { actor_id } : {}), ...(resource_type ? { resource_type } : {}) },
      { select: [...FIELDS], order: { created_at: "DESC", id: "DESC" }, skip: offset, take: limit }
    )
  res.json({ entries, count, limit, offset })
}
