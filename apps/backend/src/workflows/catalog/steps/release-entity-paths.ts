import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import type { UrlKey, UrlOwner } from "../../../modules/url-registry/validation"
import { CATALOG_ENTITY_TYPES } from "../entity-paths"

type Undo = { owner: UrlOwner } & ({ reserved: UrlKey[] } | { freed: string[] })

// A deleted product that was not published had no public URL: no redirect
// or 410 will answer for it, so its slugs go back to the pool
async function wasPublic(container: MedusaContainer, owner: UrlOwner): Promise<boolean> {
  if (owner.entity_type !== CATALOG_ENTITY_TYPES.product) {
    return true
  }
  const products = await container
    .resolve(Modules.PRODUCT)
    .listProducts({ id: owner.entity_id }, { withDeleted: true, select: ["id", "status"] })
  return products[0]?.status === "published"
}

/** Reserves a deleted record's paths, or frees them when its URL was never public. */
export const releaseEntityPathsStep = createStep(
  "catalog-release-entity-paths",
  async (owner: UrlOwner, { container }) => {
    const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    if (await wasPublic(container, owner)) {
      const reserved = await registry.releasePathsOf(owner)
      return new StepResponse(undefined, { owner, reserved } satisfies Undo)
    }
    const freed = await registry.freePathsOf(owner)
    return new StepResponse(undefined, { owner, freed } satisfies Undo)
  },
  async (undo: Undo | undefined, { container }) => {
    if (!undo) {
      return
    }
    const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    if ("freed" in undo) {
      await registry.restorePaths(undo.freed)
      return
    }
    // Claiming its own reserved path makes it active again
    for (const key of undo.reserved) {
      await registry.claimPath({ ...key, ...undo.owner })
    }
  }
)
