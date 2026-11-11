import { WorkflowResponse, createWorkflow } from "@medusajs/framework/workflows-sdk"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import { fleetIn, tenantsIn, vaultIn } from "../modules"
import { undoableStep } from "../undoable"

/**
 * What the control plane keeps of a shop's new secrets (adr/0061 §4.3, Ek
 * C8): its public key and the escrow copy sealed to the offline age
 * recipients. Public or sealed values only: the secrets themselves are
 * made before this runs (lib/vault/tenant-secrets.ts) and go to the
 * caller, never into this workflow (`store: false` all the same).
 */
export interface RecordTenantKeysInput {
  tenant_id: string
  kid: string
  public_key: string
  /** The armored age file, opened by the offline identity only. */
  escrow: string
  recipients: string[]
}

const registerKeyStep = undoableStep(
  "cp-tenant-key-register",
  async (input: RecordTenantKeysInput, container) => {
    // An unknown shop is refused here, before anything is written
    await tenantsIn(container).tenantOf(input.tenant_id)
    const key = await fleetIn(container).registerTenantKey({
      tenant_id: input.tenant_id,
      kid: input.kid,
      public_key: input.public_key,
    })
    return { output: { kid: key.kid, status: key.status }, undo: key.id }
  },
  async (id: string, container) => {
    await fleetIn(container).removeTenantKey(id)
  }
)

const escrowStep = undoableStep(
  "cp-tenant-escrow-record",
  async (input: RecordTenantKeysInput, container) => {
    const escrow = await vaultIn(container).recordEscrow({
      tenant_id: input.tenant_id,
      sealed: input.escrow,
      recipients: input.recipients,
    })
    return { output: { version: escrow.version }, undo: escrow.id }
  },
  async (id: string, container) => {
    await vaultIn(container).removeEscrow(id)
  }
)

export const recordTenantKeysWorkflow = createWorkflow(
  { name: "cp-tenant-keys-record", store: false },
  (input: WorkflowData<RecordTenantKeysInput>) => {
    const key = registerKeyStep(input)
    const escrow = escrowStep(input)
    return new WorkflowResponse({ key, escrow })
  }
)
