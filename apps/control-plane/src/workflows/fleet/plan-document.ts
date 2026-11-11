import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import { contentHash, planContent, planDocumentOf } from "../../lib/fleet/plan-content"
import type { PlanContent } from "../../lib/fleet/plan-content"
import { signPlanDocument } from "../../lib/vault/signing"
import { fleetIn, plansIn, tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What a shop's document says now (Ek C9): its status, its package's
 * limits and flags with its unexpired exceptions. Null for a shop on no
 * package: no document is issued for it, and a shop that had one keeps
 * its last (the package code is part of the contract).
 */
export async function planContentOf(
  container: Container,
  tenantId: string,
  now: Date = new Date()
): Promise<PlanContent | null> {
  const plans = plansIn(container)
  const [tenant, plan, limitOverrides, flagOverrides] = await Promise.all([
    tenantsIn(container).tenantOf(tenantId),
    plans.planOf(tenantId),
    plans.overridesOf(tenantId),
    plans.featureOverridesOf(tenantId),
  ])
  if (!plan) {
    return null
  }
  return planContent({
    tenantId,
    status: tenant.status,
    packageCode: plan.code,
    packageLimits: plan.limits,
    packageFeatures: plan.features,
    limitOverrides,
    flagOverrides,
    now,
    nodeEnv: process.env["NODE_ENV"],
  })
}

export interface IssuedPlanDocument {
  /** A new document was made; false when the content had not changed (or no package). */
  issued: boolean
  id: string | null
  serial: number | null
}

const issueStep = undoableStep(
  "cp-plan-document-issue",
  async (
    input: { tenant_id: string },
    container
  ): Promise<{ output: IssuedPlanDocument; undo: string | null }> => {
    const content = await planContentOf(container, input.tenant_id)
    if (!content) {
      return { output: { issued: false, id: null, serial: null }, undo: null }
    }
    const { issued, row } = await fleetIn(container).issuePlanDocument(
      input.tenant_id,
      contentHash(content),
      async (serial, issuedAt) => {
        const document = planDocumentOf(content, serial, issuedAt)
        // The control plane's `active` key, its seed open for this signature only (Ek C8)
        return { document, ...(await signPlanDocument(container, document)) }
      }
    )
    return {
      output: { issued, id: row.id, serial: row.serial },
      undo: issued ? row.id : null,
    }
  },
  async (id: string | null, container) => {
    if (id) {
      await fleetIn(container).removePlanDocument(id)
    }
  }
)

/**
 * A shop's plan document issued again when what it says changed (adr/0061
 * §3.2, Ek C9): built from the records, held to the contract's schema,
 * signed, stored with the next serial. The push is not part of it: it is
 * best effort and never undoes or blocks the issue (lib/fleet/push.ts).
 */
export const issuePlanDocumentWorkflow = createWorkflow(
  { name: "cp-plan-document-issue", store: false },
  (input: WorkflowData<{ tenant_id: string }>) => new WorkflowResponse(issueStep(input))
)
