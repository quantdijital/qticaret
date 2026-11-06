import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { unclaimPaths } from "../../catalog/entity-paths"
import { claimAuthorPaths } from "../paths"
import type { PathedAuthor } from "../paths"

/** A blog author's page path in the URL registry; an old one stays for its 301. */
export const claimAuthorPathStep = createStep(
  "content-claim-author-path",
  async (author: PathedAuthor, { container }) => {
    const claims = await claimAuthorPaths(container, [author])
    return new StepResponse(undefined, claims)
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
