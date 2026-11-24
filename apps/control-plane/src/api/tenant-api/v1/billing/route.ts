import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { BILLING_HISTORY_PURPOSE, billingHistoryBinding } from "@qticaret/types/control-plane"
import { billingHistoryOf } from "../../../../lib/billing/history"
import { signWithActiveKey } from "../../../../lib/vault/signing"
import { tenantCallerOf } from "../../../http/tenant-api"

/**
 * GET /tenant-api/v1/billing (a shop, signed; adr/0061 Ek C20): the
 * signing shop's own payment history, its id from the verified signature,
 * never from the request; with a binding signed by the control plane's
 * active key over the request's nonce and the history (the plan pull's
 * rule, review L3), so the shop shows only an answer to the request it
 * just sent. No other shop's record can be asked for: there is no
 * parameter. 503 `billing.unavailable` without an active key.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const caller = tenantCallerOf(req)
  res.setHeader("Cache-Control", "no-store")
  if (!caller) {
    // The guard always runs first; this is the closed default if it ever did not
    res.status(401).json({ type: "unauthorized", message: "signature.invalid" })
    return
  }
  const history = await billingHistoryOf(req.scope, caller.tenantId)
  let binding: { kid: string; signature: string }
  try {
    binding = await signWithActiveKey(
      req.scope,
      BILLING_HISTORY_PURPOSE,
      billingHistoryBinding(caller.nonce, history)
    )
  } catch {
    res.status(503).json({ type: "unavailable", message: "billing.unavailable" })
    return
  }
  res.json({ history, binding })
}
