import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../modules/audit-log/service"

/**
 * The kinds of thing the log has entries for (F12.5), for the viewer's
 * filter. Names only, no entry: not a read of the log itself.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  res.json({ resource_types: await service.resourceTypes() })
}
