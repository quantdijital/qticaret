import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import type { SignedPlanDocument } from "@qticaret/types/control-plane"
import { CONTROL_PLANE_MODULE } from "../../../modules/control-plane"
import type ControlPlaneModuleService from "../../../modules/control-plane/service"
import type { StoredPlan } from "../../../modules/control-plane/service"
import type { PlanSource } from "../../../modules/control-plane/models/control-plane-plan"

export interface StorePlanDocumentInput {
  /** Already verified: the control plane's signature, this shop's id (lib/control-plane/receive.ts). */
  signed: SignedPlanDocument
  source: PlanSource
}

/** The document against the stored one by serial; an applied one is undone to the row before. */
export const storePlanDocumentStep = createStep(
  "control-plane-store-plan-document",
  async (input: StorePlanDocumentInput, { container }) => {
    const service = container.resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    const { outcome, previous } = await service.storePlanDocument(input.signed, input.source)
    // adr/0061 Ek C15: a new status reaches the storefront at once (a suspension's 503)
    const statusChanged =
      outcome === "applied" &&
      (previous?.document.status ?? "active") !== input.signed.document.status
    return new StepResponse(
      { outcome, status_changed: statusChanged },
      outcome === "applied"
        ? {
            tenant_id: input.signed.document.tenant_id,
            serial: input.signed.document.serial,
            previous,
          }
        : undefined
    )
  },
  async (
    applied: { tenant_id: string; serial: number; previous: StoredPlan | null } | undefined,
    { container }
  ) => {
    if (!applied) {
      return
    }
    const service = container.resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    await service.restorePlanDocument(applied.tenant_id, applied.serial, applied.previous)
  }
)
