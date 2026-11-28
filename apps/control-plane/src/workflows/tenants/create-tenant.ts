import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { plansIn, tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

export interface CreateTenantInput {
  slug: string
  name: string
  /** `<slug>.<PLATFORM_DOMAIN>`, made with the record. */
  hostname: string
  created_by: string | null
  package_id: string | null
  /** The sector pack it is to be set up with (C11; applied by C12). */
  sector_pack?: string | null
  /** Its ready-made look (adr/0063 task 2.7; applied by the setup's `preset` step). */
  preset?: string | null
  /** The owner's e-mail and phone as the storefront contact at setup (default: yes). */
  storefront_contact?: boolean
  /** Its pack's sample catalogue at setup (loaded by the setup's `sample_catalog` step). */
  sample_catalog?: boolean
}

/** The record, its subdomain and first status row; undone, it is gone again, children too. */
const createRecordStep = undoableStep(
  "cp-tenant-create-record",
  async (input: CreateTenantInput, container) => {
    const tenant = await tenantsIn(container).createTenantRecord(input)
    return { output: tenant, undo: tenant.id }
  },
  async (id: string, container) => {
    await tenantsIn(container).deleteTenants([id])
  }
)

interface PlanInput {
  tenant_id: string
  package_id: string | null
  by: string | null
}

/** Its package, when one was chosen; undone, it is on none. */
const assignPlanStep = undoableStep(
  "cp-tenant-create-plan",
  async (input: PlanInput, container) => {
    if (input.package_id) {
      await plansIn(container).assignPlan(input.tenant_id, input.package_id, input.by)
    }
    return { output: input.package_id, undo: input.package_id ? input.tenant_id : "" }
  },
  async (tenantId: string, container) => {
    if (tenantId) {
      await plansIn(container).assignPlan(tenantId, null, null)
    }
  }
)

/**
 * A new shop as a record (adr/0061 §2, C7): `provisioning`, its platform
 * subdomain, optionally its package. The setup that brings it up is C10;
 * C11's wizard makes the record through this same workflow.
 */
export const createTenantWorkflow = createWorkflow(
  { name: "cp-tenant-create", store: false },
  (input: WorkflowData<CreateTenantInput>) => {
    const tenant = createRecordStep(input)
    const plan = transform({ input, tenant }, (data): PlanInput => ({
      tenant_id: data.tenant.id,
      package_id: data.input.package_id,
      by: data.input.created_by,
    }))
    assignPlanStep(plan)
    return new WorkflowResponse(tenant)
  }
)
