import type { MedusaRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { paramOf } from "../tenants/params"

/**
 * The `:service` of a provider route, as it was sent: the router decodes a
 * parameter (`%66ake` is read as `fake`), so the path's own segment after
 * `/providers/` must spell it out. Anything else is unknown (404), before
 * the vault or the gateway is asked.
 */
export function serviceParam(req: MedusaRequest): string {
  const service = paramOf(req, "service")
  const path = req.originalUrl.split("?")[0] ?? ""
  const segments = path.split("/")
  const sent = segments[segments.indexOf("providers") + 1]
  if (sent !== service) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "cp.ai_service_unknown")
  }
  return service
}
