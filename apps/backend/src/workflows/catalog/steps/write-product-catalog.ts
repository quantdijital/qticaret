import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CATALOG_EXTENSION_MODULE } from "../../../modules/catalog-extension"
import type CatalogExtensionModuleService from "../../../modules/catalog-extension/service"
import type { ExtensionFields, ProductCatalogPlan, VariantFields } from "./plan-product-catalog"

export interface WrittenCatalog {
  /** Rows made now, to be linked: the product's extension and new variant ones. */
  productExtensionId: string | null
  variantExtensions: { variant_id: string; id: string }[]
}

interface Undo {
  createdProductExtension: string | null
  createdVariantExtensions: string[]
  restoreProduct: ({ id: string } & Partial<ExtensionFields>) | null
  restoreVariants: ({ id: string } & Partial<VariantFields>)[]
}

async function writeProduct(
  service: CatalogExtensionModuleService,
  plan: ProductCatalogPlan,
  undo: Undo
): Promise<void> {
  const { id, set, previous } = plan.product
  if (Object.keys(set).length === 0) {
    // Only variants changed: no product row is made for nothing
    return
  }
  if (id) {
    await service.updateProductExtensions({ id, ...set })
    undo.restoreProduct = { id, ...previous }
  } else {
    undo.createdProductExtension = (await service.createProductExtensions(set)).id
  }
}

async function writeVariants(
  service: CatalogExtensionModuleService,
  plan: ProductCatalogPlan,
  undo: Undo
): Promise<WrittenCatalog["variantExtensions"]> {
  const existing = plan.variants.flatMap((change) =>
    change.id ? [{ ...change, id: change.id }] : []
  )
  if (existing.length > 0) {
    await service.updateVariantExtensions(existing.map(({ id, set }) => ({ id, ...set })))
    undo.restoreVariants = existing.map(({ id, previous }) => ({ id, ...previous }))
  }
  const fresh = plan.variants.filter((change) => !change.id)
  if (fresh.length === 0) {
    return []
  }
  const created = await service.createVariantExtensions(fresh.map(({ set }) => set))
  undo.createdVariantExtensions = created.map((row) => row.id)
  return created.map((row, index) => {
    const change = fresh[index]
    if (!change) {
      throw new Error("variant extensions came back in a different number than asked")
    }
    return { variant_id: change.variant_id, id: row.id }
  })
}

async function undoWrites(service: CatalogExtensionModuleService, undo: Undo): Promise<void> {
  if (undo.createdProductExtension) {
    await service.deleteProductExtensions([undo.createdProductExtension])
  }
  if (undo.createdVariantExtensions.length > 0) {
    await service.deleteVariantExtensions(undo.createdVariantExtensions)
  }
  if (undo.restoreProduct) {
    await service.updateProductExtensions(undo.restoreProduct)
  }
  if (undo.restoreVariants.length > 0) {
    await service.updateVariantExtensions(undo.restoreVariants)
  }
}

/**
 * Writes a catalog plan; the workflow links the rows it creates. A failure
 * halfway undoes this step's own writes before it is passed on: the
 * compensation only runs for steps that finished.
 */
export const writeProductCatalogStep = createStep(
  "catalog-write-product-catalog",
  async (plan: ProductCatalogPlan, { container }) => {
    const service = container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE)
    const undo: Undo = {
      createdProductExtension: null,
      createdVariantExtensions: [],
      restoreProduct: null,
      restoreVariants: [],
    }
    try {
      await writeProduct(service, plan, undo)
      const variantExtensions = await writeVariants(service, plan, undo)
      const written: WrittenCatalog = {
        productExtensionId: undo.createdProductExtension,
        variantExtensions,
      }
      return new StepResponse(written, undo)
    } catch (error) {
      await undoWrites(service, undo)
      throw error
    }
  },
  async (undo: Undo | undefined, { container }) => {
    if (undo) {
      await undoWrites(
        container.resolve<CatalogExtensionModuleService>(CATALOG_EXTENSION_MODULE),
        undo
      )
    }
  }
)
