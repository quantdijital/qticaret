import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../lib/logging"
import { rejectRequest } from "../reject"
import { routePathKeepingCase } from "../request-path"
import { auditContext, auditService } from "./context"
import { describeRoute } from "./registry"

/**
 * Reads of personal data (F2.5, adr/0011: tax ids, addresses), recorded
 * before the answer is sent. When the record cannot be written the read is
 * refused with 503: personal data is never shown without its trace.
 * `resourceType` names what the route's first ID is (`customer`, `order`).
 */
export function auditSensitiveRead(resourceType: string) {
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const { action, resourceId } = describeRoute(req.method, routePathKeepingCase(req))
    try {
      await auditService(req).record({
        kind: "sensitive_read",
        action,
        resource_type: resourceType,
        resource_id: resourceId,
        ...auditContext(req),
      })
    } catch (error) {
      logger.error({ event: "audit.write_failed", action, err: errorSummary(error) })
      rejectRequest(
        req,
        res,
        503,
        { type: "temporarily_unavailable", message: "errors.temporarily_unavailable" },
        "audit_unavailable"
      )
      return
    }
    next()
  }
}
