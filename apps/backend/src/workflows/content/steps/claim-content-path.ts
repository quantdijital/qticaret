import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { unclaimPaths } from "../../catalog/entity-paths"
import { claimContentPaths } from "../paths"
import type { PathedEntry } from "../paths"

/** The entry's page path in the URL registry (docs/13 §2.1); an old one stays reserved for its 301. */
export const claimContentPathStep = createStep(
  "content-claim-path",
  async (entry: PathedEntry, { container }) => {
    const claims = await claimContentPaths(container, [entry])
    return new StepResponse(undefined, claims)
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
