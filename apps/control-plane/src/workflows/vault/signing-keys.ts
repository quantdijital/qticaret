import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { vaultIn } from "../modules"

/**
 * The control plane's signing key rotation (adr/0061 §4.5, Ek C8), one
 * workflow per step of it. The private half is made and sealed inside the
 * vault's service: no input, output or stored step of these carries it
 * (`store: false`, §4.3).
 */

const prepareStep = createStep(
  "cp-signing-key-prepare",
  async (_: undefined, { container }) => {
    const made = await vaultIn(container).prepareSigningKey()
    return new StepResponse({ kid: made.kid, status: made.status }, made.id)
  },
  // A later step failing: the unused key and its sealed seed are dropped
  async (id, { container }) => {
    if (id) {
      await vaultIn(container).discardSigningKey(id)
    }
  }
)

/** A new key: the first one `active`, later ones `next` (published, not signing yet). */
export const prepareSigningKeyWorkflow = createWorkflow(
  { name: "cp-signing-key-prepare", store: false },
  () => new WorkflowResponse(prepareStep())
)

// Its own transaction; undoing a switch is another switch, never automatic
const switchStep = createStep("cp-signing-key-switch", async (_: undefined, { container }) => {
  return new StepResponse(await vaultIn(container).switchSigningKey())
})

/** Signing moves to the `next` key; the old one stays published as `previous`. */
export const switchSigningKeyWorkflow = createWorkflow(
  { name: "cp-signing-key-switch", store: false },
  () => new WorkflowResponse(switchStep())
)

// The last step and irreversible by design: the private half is destroyed
const retireStep = createStep("cp-signing-key-retire", async (_: undefined, { container }) => {
  return new StepResponse(await vaultIn(container).retirePreviousSigningKey())
})

/** The `previous` key leaves the published set; its private half is destroyed. */
export const retireSigningKeyWorkflow = createWorkflow(
  { name: "cp-signing-key-retire", store: false },
  () => new WorkflowResponse(retireStep())
)
