import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import type { ContactFields, ContactRecord } from "../../modules/tenants/types"
import { tenantsIn } from "../modules"
import { undoableStep } from "../undoable"

interface Undo {
  tenant_id: string
  snapshot: ContactRecord[]
}

const restore = async (undo: Undo, container: Parameters<typeof tenantsIn>[0]) => {
  await tenantsIn(container).restoreContacts(undo.tenant_id, undo.snapshot)
}

export interface SaveContactInput {
  tenant_id: string
  /** Null adds one. */
  contact_id: string | null
  fields: Omit<ContactFields, "is_primary_billing"> & { is_primary_billing?: boolean | undefined }
}

const saveContactStep = undoableStep(
  "cp-tenant-save-contact",
  async (input: SaveContactInput, container) => {
    const change = await tenantsIn(container).saveContact(
      input.tenant_id,
      input.contact_id,
      input.fields
    )
    return {
      output: { id: change.id, made: change.before === null },
      undo: { tenant_id: input.tenant_id, snapshot: change.snapshot },
    }
  },
  restore
)

/** A contact added or changed; the primary billing mark follows (adr/0061 §2). */
export const saveContactWorkflow = createWorkflow(
  { name: "cp-tenant-save-contact", store: false },
  (input: WorkflowData<SaveContactInput>) => new WorkflowResponse(saveContactStep(input))
)

const removeContactStep = undoableStep(
  "cp-tenant-remove-contact",
  async (input: { tenant_id: string; contact_id: string }, container) => {
    const change = await tenantsIn(container).removeContact(input.tenant_id, input.contact_id)
    return {
      output: { id: change.id },
      undo: { tenant_id: input.tenant_id, snapshot: change.snapshot },
    }
  },
  restore
)

/** A contact removed for good: personal data is not kept once it is not needed (KVKK). */
export const removeContactWorkflow = createWorkflow(
  { name: "cp-tenant-remove-contact", store: false },
  (input: WorkflowData<{ tenant_id: string; contact_id: string }>) =>
    new WorkflowResponse(removeContactStep(input))
)
