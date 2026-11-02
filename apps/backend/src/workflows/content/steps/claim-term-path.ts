import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { unclaimPaths } from "../../catalog/entity-paths"
import { claimTermPaths } from "../paths"
import type { PathedTerm } from "../paths"

/** A blog category's or tag's archive path in the URL registry; an old one stays for its 301. */
export const claimTermPathStep = createStep(
  "content-claim-term-path",
  async (term: PathedTerm, { container }) => {
    const claims = await claimTermPaths(container, [term])
    return new StepResponse(undefined, claims)
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
