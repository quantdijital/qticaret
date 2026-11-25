import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { gatewayCall } from "../../../../../lib/ai-gateway/call"
import { rawBodyKept } from "../../../../http/raw-body"
import { requestTarget } from "../../../../http/request"
import { tenantCallerOf } from "../../../../http/tenant-api"

/**
 * POST /tenant-api/v1/ai/calls?task=…&capability=…&service=…&operation=…
 * (a shop, signed; adr/0085 §2): the AI gateway. The body is the
 * provider's, as the shop built it (JSON or a form), its bytes as signed;
 * the query names the task, the capability, the service and the
 * operation, read from the target the signature covered (no header names
 * them). The shop is the signature's alone. What comes back is the
 * provider's answer (status, type, bytes) with the credit headers, or the
 * gateway's own refusal (`x-qt-ai-refusal`). The work is
 * lib/ai-gateway/call.ts'.
 */
export async function POST(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const caller = tenantCallerOf(req)
  const raw = rawBodyKept(req)
  if (!caller || raw === undefined) {
    res.setHeader("Cache-Control", "no-store")
    res.status(401).json({ type: "unauthorized", message: "signature.invalid" })
    return
  }
  const answer = await gatewayCall(req.scope, {
    tenantId: caller.tenantId,
    target: requestTarget(req),
    raw,
    contentType: req.headers["content-type"] ?? "",
  })
  res.status(answer.status)
  for (const [name, value] of Object.entries(answer.headers)) {
    res.setHeader(name, value)
  }
  res.end(answer.body)
}
