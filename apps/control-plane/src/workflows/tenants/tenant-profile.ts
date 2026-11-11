import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { CompanyFields, CompanyRecord } from "../../modules/tenants/types"
import { tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

const renameStep = undoableStep(
  "cp-tenant-rename",
  async (input: { tenant_id: string; name: string }, container) => {
    const before = await tenantsIn(container).tenantOf(input.tenant_id)
    await tenantsIn(container).updateTenants({ id: input.tenant_id, name: input.name })
    return { output: { from: before.name, to: input.name }, undo: { ...input, name: before.name } }
  },
  async (undo: { tenant_id: string; name: string }, container) => {
    await tenantsIn(container).updateTenants({ id: undo.tenant_id, name: undo.name })
  }
)

/** A shop's name (its slug stays: adr/0061 §2). */
export const renameTenantWorkflow = createWorkflow(
  { name: "cp-tenant-rename", store: false },
  (input: WorkflowData<{ tenant_id: string; name: string }>) =>
    new WorkflowResponse(renameStep(input))
)

export interface SaveCompanyInput {
  tenant_id: string
  /** The fields to set; a TCKN only sealed (`tckn_sealed`, `tckn_last4`). */
  fields: Partial<CompanyFields>
}

const saveCompanyStep = undoableStep(
  "cp-tenant-save-company",
  async (input: SaveCompanyInput, container) => {
    const { before } = await tenantsIn(container).saveCompany(input.tenant_id, input.fields)
    return { output: before, undo: { tenant_id: input.tenant_id, before } }
  },
  async (undo: { tenant_id: string; before: CompanyRecord | null }, container) => {
    await tenantsIn(container).restoreCompany(undo.tenant_id, undo.before)
  }
)

/** The shop's company, the invoice's addressee; what it was comes back for the audit. */
export const saveCompanyWorkflow = createWorkflow(
  { name: "cp-tenant-save-company", store: false },
  (input: WorkflowData<SaveCompanyInput>) => new WorkflowResponse(saveCompanyStep(input))
)
