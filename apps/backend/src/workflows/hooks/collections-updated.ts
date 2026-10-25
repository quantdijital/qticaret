import { StepResponse } from "@medusajs/framework/workflows-sdk"
import { updateCollectionsWorkflow } from "@medusajs/medusa/core-flows"
import { claimCollectionPaths, unclaimPaths } from "../catalog/entity-paths"

// One handler per hook: every rule for changed collections joins here
updateCollectionsWorkflow.hooks.collectionsUpdated(
  async ({ collections }, { container }) => {
    const ids = collections.map((collection) => collection.id)
    return new StepResponse(undefined, await claimCollectionPaths(container, ids))
  },
  async (claims, { container }) => {
    await unclaimPaths(container, claims ?? [])
  }
)
