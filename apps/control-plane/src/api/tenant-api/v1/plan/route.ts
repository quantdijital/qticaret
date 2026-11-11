import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { fleetIn } from "../../../../workflows/modules"
import { tenantCallerOf } from "../../../http/tenant-api"

/**
 * GET /tenant-api/v1/plan (a shop, signed; adr/0061 §3.2): the shop's
 * latest plan document as issued, `{ document, kid, signature }`, the same
 * bytes a push carries. The shop checks it as it checks a push; the pull
 * is noted for the shop page. Only the signing shop's own document: its id
 * comes from the verified signature, never from the request. 404
 * `plan.none` while none has been issued (the shop keeps what it has).
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const caller = tenantCallerOf(req)
  res.setHeader("Cache-Control", "no-store")
  if (!caller) {
    // The guard always runs first; this is the closed default if it ever did not
    res.status(401).json({ type: "unauthorized", message: "signature.invalid" })
    return
  }
  const fleet = fleetIn(req.scope)
  const latest = await fleet.latestPlanDocument(caller.tenantId)
  if (!latest) {
    res.status(404).json({ type: "not_found", message: "plan.none" })
    return
  }
  await fleet.notePlanPulled(latest.id, new Date())
  res.json({ document: latest.document, kid: latest.kid, signature: latest.signature })
}
