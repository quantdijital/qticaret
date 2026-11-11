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
    return new StepResponse(
      { outcome },
      outcome === "applied" ? { tenant_id: input.signed.document.tenant_id, previous } : undefined
    )
  },
  async (
    applied: { tenant_id: string; previous: StoredPlan | null } | undefined,
    { container }
  ) => {
    if (!applied) {
      return
    }
    const service = container.resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
    await service.restorePlanDocument(applied.tenant_id, applied.previous)
  }
)
