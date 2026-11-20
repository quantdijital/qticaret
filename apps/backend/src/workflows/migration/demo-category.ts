import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import { deleteProductCategoriesWorkflow } from "@medusajs/medusa/core-flows"
import { URL_REGISTRY_MODULE } from "../../modules/url-registry"
import type UrlRegistryModuleService from "../../modules/url-registry/service"
import { CATALOG_ENTITY_TYPES } from "../catalog/entity-paths"

/**
 * A demo category in the way of a moved one (adr/0042 Ek 2026-11-20). The
 * development seed's categories (`metadata.demo`, scripts/seed) are never
 * matched to a source's category by name; and where one holds the handle
 * a source's category wants (its old slug) while it is switched off and
 * empty (no product, no category under it), it goes, its paths freed, so
 * the moved category takes the slug and its old address. A demo category
 * that is live, or holds anything, is left alone: the moved one takes a
 * numbered handle instead.
 */

export interface CategoryRecord {
  id: string
  handle: string
  is_active?: boolean | null
  metadata?: Record<string, unknown> | null
}

/** The seed's mark (scripts/seed/data.ts `DEMO_METADATA`). */
export const isDemoCategory = (category: CategoryRecord): boolean =>
  category.metadata?.["demo"] === true

/** One a source's category may be matched to by name: live and the shop's own. */
export const isMatchable = (category: CategoryRecord): boolean =>
  category.is_active !== false && !isDemoCategory(category)

/** A switched-off demo category, by its record alone (`clearable` checks it is empty). */
export const mayGive = (category: CategoryRecord): boolean =>
  category.is_active === false && isDemoCategory(category)

// The registry's paths of the category given up (it was never the shop's own page)
const freeCategoryPathsStep = createStep(
  "migration-free-demo-category-paths",
  async (id: string, { container }) => {
    const registry = container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE)
    const freed = await registry.freePathsOf({
      entity_type: CATALOG_ENTITY_TYPES.category,
      entity_id: id,
    })
    return new StepResponse(undefined, freed)
  },
  async (freed: string[] | undefined, { container }) => {
    if (freed && freed.length > 0) {
      await container.resolve<UrlRegistryModuleService>(URL_REGISTRY_MODULE).restorePaths(freed)
    }
  }
)

/** The demo category deleted, its paths freed first (all or none). */
export const clearDemoCategoryWorkflow = createWorkflow(
  "migration-clear-demo-category",
  (input: { id: string }) => {
    const id = transform({ input }, ({ input }) => input.id)
    freeCategoryPathsStep(id)
    deleteProductCategoriesWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => [input.id]),
    })
    return new WorkflowResponse(undefined)
  }
)

/**
 * Clears the demo category holding a wanted handle when it may give it:
 * switched off, the seed's, and empty. Whether the handle is free now.
 */
export async function takeFromDemo(
  container: Pick<MedusaContainer, "resolve">,
  holder: CategoryRecord
): Promise<boolean> {
  if (!mayGive(holder)) {
    return false
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_category",
    fields: ["id", "products.id", "category_children.id"],
    filters: { id: holder.id },
  })
  const row = data[0] as
    { products?: unknown[] | null; category_children?: unknown[] | null } | undefined
  if (!row || (row.products ?? []).length > 0 || (row.category_children ?? []).length > 0) {
    return false
  }
  await clearDemoCategoryWorkflow(container as MedusaContainer).run({ input: { id: holder.id } })
  return true
}
