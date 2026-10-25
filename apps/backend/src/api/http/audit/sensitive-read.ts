import type { MedusaNextFunction, MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { errorSummary, logger } from "../../../lib/logging"
import { rejectRequest } from "../reject"
import { auditContext, auditService } from "./context"
import { auditPath, describeRoute } from "./registry"

const MAX_FIELDS_TEXT = 500
const MAX_PARAMS = 50

export interface SensitiveReadOptions {
  /** A list route: no single resource; the paging asked for is recorded. */
  list?: boolean
}

// What was asked for: `fields` (which relations were expanded) and, for
// lists, paging and the names of the filters, never their values (a search
// term can be a name or a phone number)
function readDetails(req: MedusaRequest, list: boolean): Record<string, unknown> {
  const query = req.query as Record<string, unknown>
  const fields = query["fields"]
  const details: Record<string, unknown> = {
    fields: typeof fields === "string" ? fields.slice(0, MAX_FIELDS_TEXT) : null,
  }
  if (list) {
    details["limit"] = typeof query["limit"] === "string" ? query["limit"] : null
    details["offset"] = typeof query["offset"] === "string" ? query["offset"] : null
    details["params"] = Object.keys(query).slice(0, MAX_PARAMS)
  }
  return details
}

/**
 * Reads of personal data (F2.5, adr/0011: tax ids, addresses, contact
 * details), recorded before the answer is sent. When the record cannot be
 * written the read is refused with 503: personal data is never shown without
 * its trace. `resourceType` names what the route's `:id` is.
 */
export function auditSensitiveRead(resourceType: string, options: SensitiveReadOptions = {}) {
  const list = options.list ?? false
  return async (req: MedusaRequest, res: MedusaResponse, next: MedusaNextFunction) => {
    const { action, resourceId } = describeRoute(req.method, auditPath(req))
    // Bound with `methods`, so Express has matched and decoded the parameters
    const params = req.params as Record<string, string | undefined> | undefined
    try {
      await auditService(req).record({
        kind: "sensitive_read",
        action,
        resource_type: resourceType,
        resource_id: list ? null : (params?.["id"] ?? resourceId),
        changes: readDetails(req, list),
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
