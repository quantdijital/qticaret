import type { MedusaContainer } from "@medusajs/framework/types"
import { logger } from "../logging"
import type { PlanSource } from "../../modules/control-plane/models/control-plane-plan"
import { applyPlanDocumentWorkflow } from "../../workflows/control-plane/apply-plan-document"
import { controlPlaneConfig } from "./config"
import { checkPlanDocument } from "./verify"
import type { PlanRefusal } from "./verify"

export type ReceiveResult =
  | { outcome: "applied" | "same"; serial: number }
  | { outcome: "unmanaged" }
  | { outcome: "refused"; code: PlanRefusal | "control_plane.stale_serial" }

/**
 * A plan document from the control plane, pushed or pulled (adr/0061
 * §3.2, Ek C9): checked (strict shape, signature by `kid` against
 * `CONTROL_PLANE_PUBLIC_KEYS`, this shop's id), then applied by the serial
 * rule: greater replaces, the same is a no-op, smaller (a replay) is
 * refused. A refusal changes nothing and is logged with its code; never
 * the document. Unmanaged, nothing is read.
 */
export async function receivePlanDocument(
  container: MedusaContainer,
  raw: unknown,
  source: PlanSource
): Promise<ReceiveResult> {
  const config = controlPlaneConfig()
  if (!config.managed) {
    return { outcome: "unmanaged" }
  }
  const check = checkPlanDocument(raw, config)
  if (!check.ok) {
    logger.warn({ event: "control_plane.document_refused", code: check.code, source })
    return { outcome: "refused", code: check.code }
  }
  const { serial } = check.signed.document
  const { result } = await applyPlanDocumentWorkflow(container).run({
    input: { signed: check.signed, source },
  })
  if (result.outcome === "stale") {
    logger.warn({
      event: "control_plane.document_refused",
      code: "control_plane.stale_serial",
      serial,
      source,
    })
    return { outcome: "refused", code: "control_plane.stale_serial" }
  }
  if (result.ignored.length > 0) {
    // A newer control plane's flag this shop does not know yet: left at nothing
    logger.warn({ event: "control_plane.unknown_flags", keys: result.ignored.slice(0, 20) })
  }
  if (result.outcome === "applied") {
    logger.info({ event: "control_plane.document_applied", serial, source })
  }
  return { outcome: result.outcome, serial }
}
