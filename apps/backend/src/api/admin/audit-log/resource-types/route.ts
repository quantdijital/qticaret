import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { AUDIT_LOG_MODULE } from "../../../../modules/audit-log"
import type AuditLogModuleService from "../../../../modules/audit-log/service"
import { isShopResource } from "../../../../modules/audit-log/shop-view"

/**
 * The kinds of thing the log has entries for (F12.5), for the viewer's
 * filter; the platform operator's are not offered (docs/06 principle 10).
 * Names only, no entry: not a read of the log itself.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const service = req.scope.resolve<AuditLogModuleService>(AUDIT_LOG_MODULE)
  res.json({ resource_types: (await service.resourceTypes()).filter(isShopResource) })
}
