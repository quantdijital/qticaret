import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import {
  createProductVariantsWorkflow,
  createProductsWorkflow,
  updateProductVariantsWorkflow,
  updateProductsWorkflow,
} from "@medusajs/medusa/core-flows"
import { setProductBrandWorkflow } from "../../brands/workflows"
import { upsertProductAttributesWorkflow } from "../../product-attributes/upsert-product-attributes"
import { upsertSeoMetaWorkflow } from "../../seo/upsert-seo-meta"
import { writeStockLevelsWorkflow } from "../../stock/write-levels"
import { setProductCatalogWorkflow } from "../set-product-catalog"
import type { ImportPlan } from "./plan"
import { resolveImportCostsStep } from "./steps/resolve-import-costs"
import { resolveImportStockStep } from "./steps/resolve-import-stock"

export interface ImportProductInput {
  plan: ImportPlan
  location_id: string | null
  /** The import's job and who started it, for the stock ledger (adr/0020). */
  job_id?: string | null
  actor_id?: string | null
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

// adr/0055: a sheet's plain description replaces a document the product had (the plan holds it when it changes)
const replacesDescription = (input: ImportProductInput) =>
  input.plan.productId !== null && input.plan.product["description"] !== undefined

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
  // The primary category, the unit costs (F11.4) and a description document dropped (adr/0055)
  // in one catalog save: a workflow runs once as a step
  const costs = resolveImportCostsStep(
    transform({ input, productId }, ({ input, productId }) => ({
      product_id: productId,
      costs: input.plan.costs,
    }))
  )
  when(
    "import-catalog",
    { input, costs },
    ({ input, costs }) =>
      Boolean(input.plan.primaryCategoryId) ||
      Object.keys(costs).length > 0 ||
      replacesDescription(input)
  ).then(() => {
    setProductCatalogWorkflow.runAsStep({
      input: transform({ input, productId, costs }, ({ input, productId, costs }) => ({
        product_id: productId,
        ...(input.plan.primaryCategoryId
          ? { primary_category_id: input.plan.primaryCategoryId }
          : {}),
        ...(Object.keys(costs).length > 0 ? { variants: costs } : {}),
        ...(replacesDescription(input) ? { description_doc: null } : {}),
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

// The quantities at the default warehouse, recorded in the stock ledger as the import's
function writeStock(input: Input, productId: WorkflowData<string>) {
  const levels = resolveImportStockStep(
    transform({ input, productId }, ({ input, productId }) => ({
      product_id: productId,
      location_id: input.location_id,
      stock: input.plan.stock,
    }))
  )
  when(
    "import-stock",
    { levels },
    ({ levels }) => levels.create.length + levels.update.length > 0
  ).then(() => {
    writeStockLevelsWorkflow.runAsStep({
      input: transform({ levels, input }, ({ levels, input }) => ({
        ...levels,
        reason: "import" as const,
        reference: input.job_id ?? null,
        actor_id: input.actor_id ?? null,
      })),
    })
  })
}

/**
 * Writes one sheet product (F3.9): made or changed, its variants, brand,
 * SEO fields, attributes, unit costs and stock, each through the workflow the panel's
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
