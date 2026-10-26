import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { unclaimPaths } from "../../catalog/entity-paths"
import { claimLandingPath } from "../landing-paths"
import type { PathedLanding } from "../landing-paths"

/** The landing page's path under its category's (docs/13 §2.2); an old one stays for its 301. */
export const claimLandingPathStep = createStep(
  "content-claim-landing-path",
  async (landing: PathedLanding, { container }) => {
    const claims = await claimLandingPath(container, landing)
    return new StepResponse(undefined, claims)
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
