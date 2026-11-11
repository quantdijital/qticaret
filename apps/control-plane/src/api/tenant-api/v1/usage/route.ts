import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { checkUsageReport } from "../../../../lib/fleet/usage-rules"
import { recordUsageWorkflow } from "../../../../workflows/fleet/usage-record"
import { signedBodyOf, tenantCallerOf } from "../../../http/tenant-api"

/**
 * POST /tenant-api/v1/usage (a shop, signed; adr/0061 §5.4, Ek C13): the
 * shop's hourly totals. The guard checked the signature over these exact
 * bytes (and spent the nonce); here the report is held to the contract's
 * strict schema, to the signer's own shop id and to a fresh time
 * (usage-rules.ts), then stored when it is newer than the shop's latest
 * snapshot and none came in the last ten minutes: 200 `{ stored: true }`,
 * else 409 `usage.out_of_order` or `usage.too_soon` (review M1). The
 * report is read from the signed bytes, never from a re-parsed body.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const caller = tenantCallerOf(req)
  res.setHeader("Cache-Control", "no-store")
  if (!caller) {
    // The guard always runs first; this is the closed default if it ever did not
    res.status(401).json({ type: "unauthorized", message: "signature.invalid" })
    return
  }
  const now = new Date()
  const checked = checkUsageReport(signedBodyOf(req), caller.tenantId, now)
  if (!checked.ok) {
    res.status(checked.status).json({
      type: checked.status === 403 ? "not_allowed" : "invalid_data",
      message: checked.message,
    })
    return
  }
  const { result } = await recordUsageWorkflow(req.scope).run({
    input: { report: checked.report, received_at: now.toISOString() },
  })
  if (!result.stored) {
    res.status(409).json({
      type: "conflict",
      message: result.reason === "too_soon" ? "usage.too_soon" : "usage.out_of_order",
    })
    return
  }
  res.json({ stored: true })
}
