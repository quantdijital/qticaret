import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { isRestriction, restrictionOf } from "../../lib/catalog"
import type { CategoryPlace, Restriction } from "../../lib/catalog"
import { ValidationError } from "../../lib/errors"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../modules/catalog-extension/service"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { RESTRICTED_PRODUCTS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"

type Container = Pick<MedusaContainer, "resolve">

const catalog = (container: Container) =>
  container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)

const flagOn = (container: Container) =>
  container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(RESTRICTED_PRODUCTS)

/**
 * The categories marked adults only (F13.4), or null while the shop has
 * the flag off: then no mark counts, on a page, in a feed or at checkout.
 */
export async function markedCategories(
  container: Container
): Promise<ReadonlyMap<string, Restriction> | null> {
  if (!(await flagOn(container))) {
    return null
  }
  const rows = await catalog(container).listCategoryRestrictions(
    {},
    { select: ["category_id", "restriction"] }
  )
  return new Map(rows.map((row) => [row.category_id, row.restriction]))
}

interface ProductPlaceRow {
  id: string
  categories?: (CategoryPlace | null)[] | null
  product_extension?: { restriction?: string | null } | null
}

/** Each of these products' restriction, its categories' marks included; none while the flag is off. */
export async function productRestrictions(
  container: Container,
  productIds: readonly string[]
): Promise<Map<string, Restriction>> {
  const marked = await markedCategories(container)
  if (!marked || productIds.length === 0) {
    return new Map()
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "categories.id", "categories.mpath", "product_extension.restriction"],
    filters: { id: [...productIds] },
  })
  return new Map(
    (data as ProductPlaceRow[]).flatMap((row) => {
      const restriction = restrictionOf(row.product_extension?.restriction, row.categories, marked)
      return restriction ? [[row.id, restriction] as const] : []
    })
  )
}

export interface SetCategoryRestrictionInput {
  category_id: string
  restriction: Restriction | null
}

/**
 * Marks a category adults only, or clears its mark (F13.4): marking needs
 * the flag, clearing never does. Undone, the mark before comes back.
 */
const setCategoryRestrictionStep = createStep(
  "catalog-set-category-restriction",
  async (input: SetCategoryRestrictionInput, { container }) => {
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "product_category",
      fields: ["id"],
      filters: { id: input.category_id },
    })
    if (data.length === 0) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.category_unknown")
    }
    if (input.restriction && !(await flagOn(container))) {
      throw new ValidationError("catalog.restriction_disabled", { field: "restriction" })
    }
    const service = catalog(container)
    const [before] = await service.listCategoryRestrictions(
      { category_id: input.category_id },
      { take: 1 }
    )
    if (input.restriction === null) {
      if (before) {
        await service.deleteCategoryRestrictions([before.id])
      }
    } else if (before) {
      await service.updateCategoryRestrictions({ id: before.id, restriction: input.restriction })
    } else {
      await service.createCategoryRestrictions({
        category_id: input.category_id,
        restriction: input.restriction,
      })
    }
    return new StepResponse(
      { category_id: input.category_id, restriction: input.restriction },
      { category_id: input.category_id, before: before?.restriction ?? null }
    )
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = catalog(container)
    const [now] = await service.listCategoryRestrictions(
      { category_id: undo.category_id },
      { take: 1 }
    )
    if (now) {
      await service.deleteCategoryRestrictions([now.id])
    }
    if (isRestriction(undo.before)) {
      await service.createCategoryRestrictions({
        category_id: undo.category_id,
        restriction: undo.before,
      })
    }
  }
)

/** F13.4: a category's adults-only mark, which its children and products take. */
export const setCategoryRestrictionWorkflow = createWorkflow(
  "catalog-set-category-restriction",
  (input: SetCategoryRestrictionInput) => new WorkflowResponse(setCategoryRestrictionStep(input))
)
