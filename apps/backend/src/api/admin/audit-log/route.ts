import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AUDIT_LOG_MODULE } from "../../../modules/audit-log"
import type AuditLogModuleService from "../../../modules/audit-log/service"
import type { AdminGetAuditLogType } from "./validators"

/**
 * The audit log, newest first, filtered and paged (adr/0011). The viewer
 * screen comes in F12.5. Reading it is itself recorded: entries hold IPs.
 */
export async function GET(
  req: MedusaRequest<unknown, AdminGetAuditLogType>,
  res: MedusaResponse
): Promise<void> {
  const { limit, offset, created_after, created_before, ...fields } =
    req.validatedQuery as AdminGetAuditLogType
  const service = req.scope.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)

  const createdAt = {
    ...(created_after ? { $gte: created_after } : {}),
    ...(created_before ? { $lte: created_before } : {}),
  }
  const [entries, count] = await service.listAndCountAuditEntries(
    { ...fields, ...(Object.keys(createdAt).length > 0 ? { created_at: createdAt } : {}) },
    { order: { created_at: "DESC" }, skip: offset, take: limit }
  )

  res.json({ audit_entries: entries, count, offset, limit })
}
