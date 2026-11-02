import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { URL_REGISTRY_MODULE } from "../../../modules/url-registry"
import type UrlRegistryModuleService from "../../../modules/url-registry/service"
import type { UrlKey, UrlOwner } from "../../../modules/url-registry/validation"

export interface ReleaseTermPathInput {
  owner: UrlOwner
  /** Its archive had live posts: the path stays reserved and answers 410, else it is freed. */
  was_live: boolean
}

type Undo = { owner: UrlOwner } & ({ reserved: UrlKey[] } | { freed: string[] })

/**
 * A deleted blog category's or tag's archive path (adr/0019 ek
 * 2026-11-03): one that showed posts was public and is kept for its 410;
 * an empty one goes back to the pool, so the term can be made again.
 */
export const releaseTermPathStep = createStep(
  "content-release-term-path",
  async ({ owner, was_live }: ReleaseTermPathInput, { container }) => {
    const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    if (was_live) {
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
    for (const key of undo.reserved) {
      await registry.claimPath({ ...key, ...undo.owner })
    }
  }
)
