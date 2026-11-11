import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { SignedPlanDocument } from "@qticaret/types/control-plane"
import { receivePlanDocument } from "../../../../lib/control-plane/receive"

const STATUS_OF: Readonly<Record<string, number>> = {
  "control_plane.document_invalid": 400,
  "signature.malformed": 401,
  "signature.unknown_key": 401,
  "signature.invalid": 401,
  "control_plane.wrong_tenant": 403,
  "control_plane.stale_serial": 409,
}

/**
 * POST /hooks/control-plane/plan (adr/0061 §3.2, Ek C9): the control
 * plane pushes this shop's signed plan document. Checked against
 * `CONTROL_PLANE_PUBLIC_KEYS` by `kid`, refused unless it is this shop's
 * (`TENANT_ID`), applied only when its serial is greater than the stored
 * one: the same serial answers 200 and changes nothing (a repeated push),
 * a smaller one is a replay and answers 409. Unmanaged (no public keys),
 * 404. The body is already within 16 KB and the strict schema
 * (control-plane-routes.ts).
 */
export async function POST(
  req: MedusaRequest<SignedPlanDocument>,
  res: MedusaResponse
): Promise<void> {
  const result = await receivePlanDocument(req.scope, req.validatedBody, "push")
  res.setHeader("Cache-Control", "no-store")
  switch (result.outcome) {
    case "unmanaged":
      res.status(404).json({ type: "not_found", message: "control_plane.unmanaged" })
      return
    case "refused":
      res.status(STATUS_OF[result.code] ?? 400).json({ type: "invalid_data", message: result.code })
      return
    case "applied":
    case "same":
      res.json({ applied: result.outcome === "applied", serial: result.serial })
  }
}
