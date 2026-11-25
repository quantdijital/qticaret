import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { withMonthlyGrant } from "../../../../../lib/ai-credits/status-grant"
import { creditsStatusOf } from "../../../../../lib/ai-gateway/tenant"
import { tenantCallerOf } from "../../../../http/tenant-api"

/**
 * GET /tenant-api/v1/ai/credits (a shop, signed; adr/0085 §2): whether
 * the platform's AI credits can be used now and, only then, the signing
 * shop's own wallet (with its month's whole grant, P5b), the service
 * behind each capability (never a model), the credit table, the packs
 * offered and its pending request. The shop is the signature's, never the
 * request's; the time is the server's.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const caller = tenantCallerOf(req)
  res.setHeader("Cache-Control", "no-store")
  if (!caller) {
    // The guard always runs first; this is the closed default if it ever did not
    res.status(401).json({ type: "unauthorized", message: "signature.invalid" })
    return
  }
  const now = new Date()
  const status = await creditsStatusOf(req.scope, caller.tenantId, now)
  res.json(await withMonthlyGrant(req.scope, caller.tenantId, now, status))
}
