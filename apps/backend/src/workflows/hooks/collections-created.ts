import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { createCollectionsWorkflow } from "@medusajs/medusa/core-flows"
import { claimCollectionPaths, unclaimPaths } from "../catalog/entity-paths"

// One handler per hook: every rule for new collections joins here
createCollectionsWorkflow.hooks.collectionsCreated(
  async ({ collections }, { container }) => {
    const ids = collections.map((collection) => collection.id)
    return new StepResponse(undefined, await claimCollectionPaths(container, ids))
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
