import type { MedusaContainer } from "@medusajs/framework/types"
import type { WorkflowData } from "@medusajs/framework/workflows-sdk"
import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import { updateProductVariantsWorkflow, updateProductsWorkflow } from "@medusajs/medusa/core-flows"
import { setProductAddonTemplatesWorkflow } from "../../addon-templates"
import { setProductAltsWorkflow } from "../../media/workflows"
import { upsertSeoMetaWorkflow } from "../../seo/upsert-seo-meta"
import { writeStockLevelsWorkflow } from "../../stock/write-levels"
import { setProductCatalogWorkflow } from "../set-product-catalog"
import type { BulkWrite } from "./plan"

interface CategoryInput {
  product_id: string
  category_ids?: string[]
  primary_category_id?: string | null
}

/**
 * A product's categories and its primary one in one run: the categories
 * first, so a primary category just added is the product's when it is
 * checked; a failure undoes both.
 */
export const bulkCategoryWorkflow = createWorkflow(
  "catalog-bulk-category",
  (input: WorkflowData<CategoryInput>) => {
    when("bulk-categories", { input }, ({ input }) => input.category_ids !== undefined).then(() => {
      updateProductsWorkflow.runAsStep({
        input: transform({ input }, ({ input }) => ({
          selector: { id: input.product_id },
          // As relations, not `category_ids`: Medusa's step then reads the old
          // categories first, and puts them back if a later step fails
          update: {
            categories: (input.category_ids ?? []).map((id) => ({ id })),
          } as never,
        })),
      })
    })
    when(
      "bulk-primary-category",
      { input },
      ({ input }) => input.primary_category_id !== undefined
    ).then(() => {
      setProductCatalogWorkflow.runAsStep({
        input: transform({ input }, ({ input }) => ({
          product_id: input.product_id,
          primary_category_id: input.primary_category_id ?? null,
        })),
      })
    })
    return new WorkflowResponse(transform({ input }, ({ input }) => input.product_id))
  }
)

export interface WriteOrigin {
  job_id: string | null
  actor_id: string | null
}

/**
 * One product's change, through the workflow the panel's own save uses
 * (its hooks and checks included): Medusa's for prices and status, ours
 * for stock (ledger reason `bulk_edit`), categories, SEO, alt texts and
 * unit costs, and add-on template links (adr/0052 Ek 2026-11-23).
 */
export async function writeBulkChange(
  container: MedusaContainer,
  productId: string,
  write: BulkWrite,
  origin: WriteOrigin
): Promise<void> {
  switch (write.action) {
    case "price":
      await updateProductVariantsWorkflow(container).run({
        input: { product_variants: write.variants },
      })
      return
    case "stock":
      await writeStockLevelsWorkflow(container).run({
        input: {
          create: write.create,
          update: write.update,
          adjust: write.adjust,
          reason: "bulk_edit",
          reference: origin.job_id,
          actor_id: origin.actor_id,
        },
      })
      return
    case "status":
      await updateProductsWorkflow(container).run({
        input: { selector: { id: productId }, update: { status: write.status } },
      })
      return
    case "category":
      await bulkCategoryWorkflow(container).run({
        input: {
          product_id: productId,
          ...(write.category_ids ? { category_ids: write.category_ids } : {}),
          ...(write.primary_category_id !== undefined
            ? { primary_category_id: write.primary_category_id }
            : {}),
        },
      })
      return
    case "seo_template":
      await upsertSeoMetaWorkflow(container).run({
        input: { entity_type: "product", entity_id: productId, values: write.values },
      })
      return
    case "alt_text":
      await setProductAltsWorkflow(container).run({
        input: { product_id: productId, alts: write.alts },
      })
      return
    case "cost":
      await setProductCatalogWorkflow(container).run({
        input: { product_id: productId, variants: write.variants },
      })
      return
    case "addon_template":
      await setProductAddonTemplatesWorkflow(container).run({
        input: { product_id: productId, template_ids: write.template_ids },
      })
      return
  }
}
