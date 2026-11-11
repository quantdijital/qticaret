import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { INTEGRATION_CREDENTIALS_MODULE } from "../../modules/integration-credentials"
import type {
  RewrapTally,
  default as IntegrationCredentialsModuleService,
} from "../../modules/integration-credentials/service"

export interface RewrapCredentialsInput {
  /** Stop after this many rows moved (a partial run); every row when unset. */
  limit?: number
}

/**
 * The credentials KEK rotation's pass (adr/0061 §4.1, Ek C17): rows under
 * an older configured KEK get their data key rewrapped under the current
 * one, rows still in adr/0027's format are sealed as envelopes. Each row
 * is compare-and-swapped on its sealed text. No undo, on purpose: a
 * rewrapped row and the one it replaced open alike, so a half-done run is
 * a valid state and the next one finishes it. Counts and provider names
 * only; nothing is kept (`store: false`).
 */
const rewrapCredentialsStep = createStep(
  "integration-credentials-rewrap",
  async (input: RewrapCredentialsInput, { container }) => {
    const tally = await container
      .resolve<IntegrationCredentialsModuleService>(INTEGRATION_CREDENTIALS_MODULE)
      .rewrapAll(input.limit === undefined ? {} : { limit: input.limit })
    return new StepResponse<RewrapTally>(tally)
  }
)

export const rewrapCredentialsWorkflow = createWorkflow(
  { name: "integration-credentials-rewrap", store: false },
  (input: RewrapCredentialsInput) => new WorkflowResponse(rewrapCredentialsStep(input))
)
