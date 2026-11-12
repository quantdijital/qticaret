import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import { billingSummaryOf } from "../../lib/billing/summary"
import { contentHash, planContent, planDocumentOf } from "../../lib/fleet/plan-content"
import type { PlanContent } from "../../lib/fleet/plan-content"
import { signPlanDocument } from "../../lib/vault/signing"
import { fleetIn, plansIn, tenantsIn, vaultIn } from "../modules"
import { undoableStep } from "../undoable"

type Container = Pick<MedusaContainer, "resolve">

/**
 * What a shop's document says now (Ek C9): its status, its package's
 * limits and flags with its unexpired exceptions, its billing (Ek C16). Null for a shop on no
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
  // Ek C16: the subscription's state, its due charge, the package's name and how to pay
  const billing = await billingSummaryOf(container, tenantId, plan)
  return planContent({
    tenantId,
    status: tenant.status,
    packageCode: plan.code,
    packageLimits: plan.limits,
    packageFeatures: plan.features,
    limitOverrides,
    flagOverrides,
    billing,
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
    // Read under the shop's document lock (Ek C15 review L4): the status a suspension
    // or its end just wrote, never one read before another move committed
    const { issued, row } = await fleetIn(container).issuePlanDocument(
      input.tenant_id,
      async () => {
        const content = await planContentOf(container, input.tenant_id)
        // Ek C19 I2: the active key too, so a key switch issues every shop's document again
        const active = content ? await vaultIn(container).signingKeyIn("active") : null
        return content
          ? {
              contentHash: contentHash(content),
              ...(active ? { kid: active.kid } : {}),
              build: async (serial: number, issuedAt: Date) => {
                const document = planDocumentOf(content, serial, issuedAt)
                // The control plane's `active` key, its seed open for this signature only (Ek C8)
                return { document, ...(await signPlanDocument(container, document)) }
              },
            }
          : null
      }
    )
    return {
      output: { issued, id: row?.id ?? null, serial: row?.serial ?? null },
      undo: issued ? (row?.id ?? null) : null,
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
