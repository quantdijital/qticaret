import { Modules } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { acquireLockStep, createRemoteLinkStep, releaseLockStep } from "@medusajs/medusa/core-flows"
import { CATALOG_EXTENSION_MODULE } from "../../modules/catalog-extension"
import { planProductCatalogStep } from "./steps/plan-product-catalog"
import type { SetProductCatalogInput } from "./steps/plan-product-catalog"
import { writeProductCatalogStep } from "./steps/write-product-catalog"

const SUCCESSOR_LOCK = "catalog:successors"

/**
 * Saves a product's catalog fields and its variants' MPNs (F3.1). A lock
 * per product keeps two first saves from making two extension rows; every
 * step undoes itself if a later one fails.
 */
export const setProductCatalogWorkflow = createWorkflow(
  "catalog-set-product-catalog",
  (input: SetProductCatalogInput) => {
    // Setting a successor also takes the shop-wide successor lock: two saves
    // (A → B, B → A) checked side by side would each miss the loop
    const lockKey = transform({ input }, ({ input }) => [
      `catalog:${input.product_id}`,
      ...(input.successor_product_id ? [SUCCESSOR_LOCK] : []),
    ])
    acquireLockStep({ key: lockKey, timeout: 10, ttl: 30 })

    const plan = planProductCatalogStep(input)
    const written = writeProductCatalogStep(plan)

    const links = transform({ plan, written }, ({ plan, written }) => [
      ...(written.productExtensionId
        ? [
            {
              [Modules.PRODUCT]: { product_id: plan.product_id },
              [CATALOG_EXTENSION_MODULE]: { product_extension_id: written.productExtensionId },
            },
          ]
        : []),
      ...written.variantExtensions.map(({ variant_id, id }) => ({
        [Modules.PRODUCT]: { product_variant_id: variant_id },
        [CATALOG_EXTENSION_MODULE]: { variant_extension_id: id },
      })),
    ])
    createRemoteLinkStep(links)

    releaseLockStep({ key: lockKey })
    return new WorkflowResponse({ product_id: input.product_id })
  }
)
