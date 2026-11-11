import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLAN_PULL_PURPOSE, planPullBinding } from "@qticaret/types/control-plane"
import { signWithActiveKey } from "../../../../lib/vault/signing"
import { fleetIn } from "../../../../workflows/modules"
import { tenantCallerOf } from "../../../http/tenant-api"

/**
 * GET /tenant-api/v1/plan (a shop, signed; adr/0061 §3.2): the shop's
 * latest plan document as issued (`plan`: the same bytes a push carries)
 * and a binding signed with the control plane's active key over the
 * request's own nonce and that document (review L3): the shop accepts the
 * answer only for the request it just sent, so a replayed answer proves
 * nothing. Only the signing shop's own document: its id comes from the
 * verified signature, never from the request. 404 `plan.none` while none
 * has been issued (the shop keeps what it has).
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
  const plan = { document: latest.document, kid: latest.kid, signature: latest.signature }
  let binding: { kid: string; signature: string }
  try {
    binding = await signWithActiveKey(
      req.scope,
      PLAN_PULL_PURPOSE,
      planPullBinding(caller.nonce, plan)
    )
  } catch {
    // No active signing key: nothing can be vouched for now
    res.status(503).json({ type: "unavailable", message: "plan.unavailable" })
    return
  }
  await fleet.notePlanPulled(latest.id, new Date())
  res.json({ plan, binding })
}
