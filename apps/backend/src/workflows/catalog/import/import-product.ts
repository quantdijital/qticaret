import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  createInventoryLevelsWorkflow,
  createProductVariantsWorkflow,
  createProductsWorkflow,
  updateInventoryLevelsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { setProductBrandWorkflow } from "../../brands/workflows"
import { upsertProductAttributesWorkflow } from "../../product-attributes/upsert-product-attributes"
import { upsertSeoMetaWorkflow } from "../../seo/upsert-seo-meta"
import { setProductCatalogWorkflow } from "../set-product-catalog"
import type { ImportPlan } from "./plan"
import { resolveImportStockStep } from "./steps/resolve-import-stock"

export interface ImportProductInput {
  plan: ImportPlan
  location_id: string | null
}

type Input = WorkflowData<ImportProductInput>

// The product made, or its fields and variants changed; its id either way
function writeProduct(input: Input) {
  const created = when(
    "import-create",
    { input },
    ({ input }) => input.plan.productId === null
  ).then(() =>
    createProductsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        // The plan's fields are Medusa's create input, checked as the panel's are
        products: [
          {
            ...input.plan.product,
            options: input.plan.options ?? [],
            variants: input.plan.variantCreates,
          } as never,
        ],
      })),
    })
  )
  when(
    "import-update",
    { input },
    ({ input }) => input.plan.productId !== null && Object.keys(input.plan.product).length > 0
  ).then(() => {
    updateProductsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        selector: { id: input.plan.productId ?? "" },
        update: input.plan.product as never,
      })),
    })
  })
  when(
    "import-update-variants",
    { input },
    ({ input }) => input.plan.productId !== null && input.plan.variantUpdates.length > 0
  ).then(() => {
    updateProductVariantsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        product_variants: input.plan.variantUpdates as never[],
      })),
    })
  })
  when(
    "import-add-variants",
    { input },
    ({ input }) => input.plan.productId !== null && input.plan.variantCreates.length > 0
  ).then(() => {
    createProductVariantsWorkflow.runAsStep({
      input: transform({ input }, ({ input }) => ({
        product_variants: input.plan.variantCreates as never[],
      })),
    })
  })
  return transform(
    { input, created },
    ({ input, created }) =>
      input.plan.productId ?? (created as { id: string }[] | undefined)?.[0]?.id ?? ""
  )
}

// What the product links to and carries besides: brand, primary category, SEO fields, attributes
function writeExtras(input: Input, productId: WorkflowData<string>) {
  when("import-brand", { input }, ({ input }) => input.plan.brandId !== undefined).then(() => {
    setProductBrandWorkflow.runAsStep({
      input: transform({ input, productId }, ({ input, productId }) => ({
        product_id: productId,
        brand_id: input.plan.brandId ?? null,
      })),
    })
  })
  when("import-primary-category", { input }, ({ input }) =>
    Boolean(input.plan.primaryCategoryId)
  ).then(() => {
    setProductCatalogWorkflow.runAsStep({
      input: transform({ input, productId }, ({ input, productId }) => ({
        product_id: productId,
        primary_category_id: input.plan.primaryCategoryId ?? null,
      })),
    })
  })
  when("import-seo", { input }, ({ input }) => input.plan.seo !== null).then(() => {
    upsertSeoMetaWorkflow.runAsStep({
      input: transform({ input, productId }, ({ input, productId }) => ({
        entity_type: "product" as const,
        entity_id: productId,
        values: input.plan.seo ?? {},
      })),
    })
  })
  when("import-attributes", { input }, ({ input }) => input.plan.attributes !== null).then(() => {
    upsertProductAttributesWorkflow.runAsStep({
      input: transform({ input, productId }, ({ input, productId }) => ({
        product_id: productId,
        template_id: input.plan.attributes?.template_id ?? null,
        values: input.plan.attributes?.values ?? {},
      })),
    })
  })
}

// The quantities at the default warehouse, through the level workflows (the stock ledger hears them)
function writeStock(input: Input, productId: WorkflowData<string>) {
  const levels = resolveImportStockStep(
    transform({ input, productId }, ({ input, productId }) => ({
      product_id: productId,
      location_id: input.location_id,
      stock: input.plan.stock,
    }))
  )
  when("import-stock-create", { levels }, ({ levels }) => levels.create.length > 0).then(() => {
    createInventoryLevelsWorkflow.runAsStep({
      input: transform({ levels }, ({ levels }) => ({ inventory_levels: levels.create })),
    })
  })
  when("import-stock-update", { levels }, ({ levels }) => levels.update.length > 0).then(() => {
    updateInventoryLevelsWorkflow.runAsStep({
      input: transform({ levels }, ({ levels }) => ({ updates: levels.update })),
    })
  })
}

/**
 * Writes one sheet product (F3.9): made or changed, its variants, brand,
 * SEO fields, attributes and stock, each through the workflow the panel's
 * own save uses (their hooks and checks included), nested so that a step
 * failing undoes the product's earlier ones. One product per run: a bad
 * row costs its product, not the import.
 */
export const importProductWorkflow = createWorkflow(
  "catalog-import-product",
  (input: WorkflowData<ImportProductInput>) => {
    const productId = writeProduct(input)
    writeExtras(input, productId)
    writeStock(input, productId)
    return new WorkflowResponse(productId)
  }
)
