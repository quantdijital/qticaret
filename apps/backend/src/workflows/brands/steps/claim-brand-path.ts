import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { claimBrandPaths, unclaimPaths } from "../../catalog/entity-paths"

/** The brand's page path in the URL registry (docs/13 §2.1); an old one stays reserved for its 301. */
export const claimBrandPathStep = createStep(
  "brands-claim-path",
  async (brand: { id: string; handle: string; is_active: boolean }, { container }) => {
    const claims = await claimBrandPaths(container, [brand])
    return new StepResponse(undefined, claims)
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
