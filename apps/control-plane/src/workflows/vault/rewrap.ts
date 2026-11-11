import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { RewrapTally } from "../../lib/vault/rewrap"
import { tenantsIn, vaultIn } from "../modules"

export interface RewrapResult {
  secret_record: RewrapTally
  tenant_company: RewrapTally
}

/**
 * Every sealed value's data key moved from an older configured KEK to the
 * current one (adr/0061 §4.1, Ek C8): the vault's secrets and the shops'
 * TCKNs, each row compare-and-swapped in its own transaction. No undo: a
 * rewrapped row and the row it replaced open alike, so a half-done run is
 * a valid state and the next run finishes it. Counts and row ids only.
 */
const rewrapStep = createStep("cp-sealed-rewrap", async (_: undefined, { container }) => {
  const result: RewrapResult = {
    secret_record: await vaultIn(container).rewrapSecrets(),
    tenant_company: await tenantsIn(container).rewrapTckns(),
  }
  return new StepResponse(result)
})

export const rewrapSealedWorkflow = createWorkflow(
  { name: "cp-sealed-rewrap", store: false },
  () => new WorkflowResponse(rewrapStep())
)
